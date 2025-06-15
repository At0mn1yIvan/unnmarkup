import json
from datetime import timedelta

import numpy as np
from common import constants as common_constants
from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Q
from django.forms import modelformset_factory
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View
from django.views.generic import CreateView, ListView
from unet import unet_ecg

from . import constants as local_constants
from .forms import (FinalSignalValidationDecisionForm, SignalUploadForm,
                    SingleMarkupValidationItemForm)
from .mixins import (UserIsMarkerOrSuperuserMixin,
                     UserIsSupplierOrSuperuserMixin,
                     UserIsValidatorOrSuperuserMixin)
from .models import Diagnosis, Markup, Signal

# @login_required
# # Ставим ограничение на суперпользователя и разметчика
# # Перепишем под CBV вместо функции
# def markup(request):
#     # Создание записи Markup здесь или отдельной функцией в классе

#     # Тут необходимо выдать signal.data_file и прочитать его через np.load().tolist()
#     data = np.load("media/vanya.npy").tolist()

#     # TODO плейсхолдер для ответа нейронной сети
#     with open("media/markup.json", "r", encoding="utf-8") as f:
#         markups = json.load(f)

#     return render(
#         request,
#         "markup/markup.html",
#         context={
#             "data": data,
#             "ecg_names": constants.ECG_LEADS,
#             "markup_types": constants.MARKUP_TYPES,
#             "markups": markups,
#         },
#     )


class ValidationSignalListView(
    LoginRequiredMixin, UserIsValidatorOrSuperuserMixin, ListView
):  # pragma: no cover
    model = Markup
    template_name = "markup/validation_queue_list.html"
    context_object_name = "history_markups"

    paginate_by = 10

    def get_queryset(self):
        """
        Возвращает историю разметок, для которых текущий валидатор принял финальное решение
        (статус 'approved' или 'rejected').
        """
        validator_profile = self.request.user.validator_profile

        return (
            Markup.objects.filter(
                validator=validator_profile,
                status__in=["approved", "rejected"],
            )
            .select_related("signal", "marker__user")
            .order_by("-updated_at")
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Панель валидатора"

        active_validation_signal_obj = None
        validator_profile = self.request.user.validator_profile

        if validator_profile:
            active_markups_for_current_validator = Markup.objects.filter(
                validator=validator_profile, status="for_validation"
            ).select_related("signal")

            if active_markups_for_current_validator.exists():
                active_validation_signal_obj = (
                    active_markups_for_current_validator.first().signal
                )

        context["active_validation_signal"] = active_validation_signal_obj
        context["can_take_new_validation_task"] = (
            not active_validation_signal_obj
        )
        context["has_validator_profile"] = validator_profile is not None

        return context


class StartSignalValidationView(
    LoginRequiredMixin, UserIsValidatorOrSuperuserMixin, View
):  # pragma: no cover
    @transaction.atomic
    def get(self, request, *args, **kwargs):
        validator_profile = self.request.user.validator_profile

        # 1. Проверить, нет ли у валидатора уже активной валидации
        active_signal_check = (
            Markup.objects.filter(
                validator=validator_profile, status="for_validation"
            )
            .select_related("signal")
            .first()
        )

        if active_signal_check:
            signal_obj = active_signal_check.signal
            messages.info(
                request,
                f"Вы уже работаете над валидацией сигнала: {signal_obj.original_filename}. Пожалуйста, завершите её.",
            )
            return redirect(
                "markup:perform_signal_validation", signal_id=signal_obj.id
            )

        # 2. Найти Signal для новой валидации
        # Аннотируем сигналы, чтобы посчитать количество разметок 'pending_validation' для каждого
        # и проверить другие условия.

        # Подзапрос: существует ли разметка 'for_validation' для этого сигнала (взят ли другим)
        is_being_validated_subquery = Markup.objects.filter(
            signal=OuterRef("pk"), status="for_validation"
        )
        # Подзапрос: существует ли разметка 'approved' для этого сигнала
        has_approved_markup_subquery = Markup.objects.filter(
            signal=OuterRef("pk"), status="approved"
        )

        candidate_signals = (
            Signal.objects.annotate(
                num_pending_validation_markups=Count(
                    "markups", filter=Q(markups__status="pending_validation")
                ),
                is_actively_being_validated=Exists(
                    is_being_validated_subquery
                ),
                has_approved_markup=Exists(has_approved_markup_subquery),
            )
            .filter(
                markup_assignments_count=Signal.MAX_MARKUP_ASSIGNMENTS,  # Было взято 3 разметчиками
                num_pending_validation_markups=Signal.MAX_MARKUP_ASSIGNMENTS,  # Все 3 сдали на проверку
                is_actively_being_validated=False,  # Не взят другим валидатором
                has_approved_markup=False,  # Еще не утвержден
            )
            .order_by("created_at")
        )  # Например, самые старые сначала

        signal_to_validate = candidate_signals.first()

        if not signal_to_validate:
            messages.info(
                request,
                "В настоящее время нет сигналов, полностью готовых к валидации и соответствующих всем критериям.",
            )
            return redirect("markup:validation_queue_list")

        # 3. "Захватить" разметки этого сигнала для текущего валидатора
        markups_to_assign_qs = Markup.objects.filter(
            signal=signal_to_validate, status="pending_validation"
        )

        # Должно быть ровно MAX_MARKUP_ASSIGNMENTS разметок
        if markups_to_assign_qs.count() == Signal.MAX_MARKUP_ASSIGNMENTS:
            for markup_item in markups_to_assign_qs:
                markup_item.status = "for_validation"
                markup_item.validator = validator_profile
                markup_item.save(
                    update_fields=["status", "validator", "updated_at"]
                )

            messages.success(
                request,
                f"Вы взяли на валидацию сигнал: {signal_to_validate.original_filename}",
            )
            return redirect(
                "markup:perform_signal_validation",
                signal_id=signal_to_validate.id,
            )
        else:
            # Эта ситуация маловероятна, если логика фильтрации выше верна,
            # но это защита от неожиданных состояний данных.
            messages.error(
                request,
                f"Неожиданное количество разметок для сигнала '{signal_to_validate.original_filename}'. Ожидалось {Signal.MAX_MARKUP_ASSIGNMENTS}. Обратитесь к администратору.",
            )
            return redirect("markup:validation_queue_list")


class PerformSignalValidationView(
    LoginRequiredMixin, UserIsValidatorOrSuperuserMixin, View
):  # pragma: no cover
    template_name = "markup/perform_signal_validation.html"

    def get_signal_and_markups(self, signal_id, validator_profile):
        signal = get_object_or_404(Signal, pk=signal_id)
        markups_for_validation_qs = (
            Markup.objects.filter(
                signal=signal,
                status="for_validation",
                validator=validator_profile,
            )
            .select_related("marker__user")
            .prefetch_related("diagnoses__parent")
            .order_by("created_at")
        )

        if not markups_for_validation_qs.exists():
            messages.warning(
                self.request,
                f"Для сигнала '{signal.original_filename}' не найдены активные разметки для вашей валидации.",
            )
            raise Http404("Активные разметки для валидации не найдены.")

        return signal, markups_for_validation_qs

    def get_detailed_markups_data(self, markups_queryset):
        """
        Вспомогательный метод для подготовки данных для JS отображения,
        включая диагнозы в формате "родитель | ребенок".
        """
        data = []
        for markup_instance in markups_queryset:
            # Формируем список диагнозов в формате "родитель | ребенок"
            diagnoses_paths = []
            for diagnosis in markup_instance.diagnoses.all():
                if diagnosis.parent:
                    diagnoses_paths.append(
                        f"{diagnosis.parent.name} | {diagnosis.name}"
                    )

            data.append(
                {
                    "id": markup_instance.id,
                    "marker_name": markup_instance.marker.user.get_full_name(),
                    "markup_data_json": json.dumps(
                        markup_instance.markup_data or []
                    ),
                    "diagnoses_paths_json": json.dumps(
                        diagnoses_paths or []
                    ),  # Теперь это JSON-строка списка путей
                    "is_markup_confirmed_initial": markup_instance.is_markup_annotations_confirmed,
                    "is_diagnoses_confirmed_initial": markup_instance.is_diagnoses_confirmed,
                }
            )
        return data

    def get(self, request, signal_id, *args, **kwargs):
        validator_profile = self.request.user.validator_profile

        try:
            signal, markups_for_validation_qs = self.get_signal_and_markups(
                signal_id, validator_profile
            )
        except Http404:
            return redirect("markup:validation_queue_list")

        MarkupValidationFormSet = modelformset_factory(
            Markup,
            form=SingleMarkupValidationItemForm,
            fields=(
                "is_markup_annotations_confirmed",
                "is_diagnoses_confirmed",
            ),
            extra=0,
            can_delete=False,
        )
        formset = MarkupValidationFormSet(
            queryset=markups_for_validation_qs, prefix="markup_items"
        )

        final_choices_data = [
            (
                markup.id,
                f"Разметка от: {markup.marker.user.get_full_name()} (ID: {markup.id})",
            )
            for markup in markups_for_validation_qs  # Используем queryset напрямую
        ]
        final_choices_data.append(
            ("reject_all", "Отклонить все разметки для этого сигнала")
        )
        final_decision_form = FinalSignalValidationDecisionForm(
            markup_choices_with_data=final_choices_data,
            prefix="final_decision",
        )

        # Получаем список словарей detailed_markups_data
        # detailed_markups_list = self.get_detailed_markups_data(
        #     markups_for_validation_qs
        # )

        # Преобразуем список в словарь для удобного доступа в шаблоне по ID
        # detailed_markups_dict = {
        #     item_data["id"]: item_data for item_data in detailed_markups_list
        # }

        context = {
            "page_title": f"Валидация сигнала: {signal.original_filename}",
            "signal": signal,
            "formset": formset,
            "final_decision_form": final_decision_form,
            "markups_queryset": markups_for_validation_qs,  # Queryset для итерации в шаблоне
        }
        return render(request, self.template_name, context)

    @transaction.atomic
    def post(self, request, signal_id, *args, **kwargs):
        validator_profile = self.request.user.validator_profile

        try:
            signal, markups_for_validation_initial_qs = (
                self.get_signal_and_markups(signal_id, validator_profile)
            )
        except Http404:
            return redirect("markup:validation_queue_list")

        MarkupValidationFormSet = modelformset_factory(
            Markup,
            form=SingleMarkupValidationItemForm,
            fields=(
                "is_markup_annotations_confirmed",
                "is_diagnoses_confirmed",
            ),
            extra=0,
        )
        formset = MarkupValidationFormSet(
            request.POST,
            queryset=markups_for_validation_initial_qs,
            prefix="markup_items",
        )

        final_choices_data_for_form = [
            (
                markup.id,
                f"Разметка от: {markup.marker.user.get_full_name()} (ID: {markup.id})",
            )
            for markup in markups_for_validation_initial_qs
        ]
        final_choices_data_for_form.append(
            ("reject_all", "Отклонить все разметки для этого сигнала")
        )

        final_decision_form = FinalSignalValidationDecisionForm(
            markup_choices_with_data=final_choices_data_for_form,
            data=request.POST,
            prefix="final_decision",
        )

        if formset.is_valid() and final_decision_form.is_valid():
            # Шаг 1: Обновляем is_..._confirmed для каждой разметки. Данные НЕ обнуляем.
            for form_in_formset in formset:
                if form_in_formset.has_changed():
                    markup_instance = form_in_formset.instance
                    markup_instance.is_markup_annotations_confirmed = (
                        form_in_formset.cleaned_data.get(
                            "is_markup_annotations_confirmed", False
                        )
                    )
                    markup_instance.is_diagnoses_confirmed = (
                        form_in_formset.cleaned_data.get(
                            "is_diagnoses_confirmed", False
                        )
                    )
                    markup_instance.validator = validator_profile
                    markup_instance.save(
                        update_fields=[
                            "is_markup_annotations_confirmed",
                            "is_diagnoses_confirmed",
                            "validator",
                            "updated_at",
                        ]
                    )

            # Перезагружаем разметки, чтобы получить обновленные значения is_confirmed
            # Это важно для Шага 2, где мы принимаем решение о статусе 'approved'
            all_markups_for_signal = Markup.objects.filter(
                signal=signal,
                validator=validator_profile,
                status="for_validation",
            )

            # Шаг 2: Применяем финальное решение по всему сигналу
            final_choice_value = final_decision_form.cleaned_data[
                "final_markup_choice"
            ]
            approved_markup_successfully_set = False

            if final_choice_value == "reject_all":
                for mu_instance in all_markups_for_signal:
                    mu_instance.status = "rejected"
                    # Данные НЕ обнуляем, только флаги is_..._confirmed сбрасываем (если нужно по логике)
                    # mu_instance.is_markup_annotations_confirmed = False # Оставляем как есть, или сбрасываем?
                    # mu_instance.is_diagnoses_confirmed = False       # Решите, нужно ли сбрасывать эти флаги при reject_all
                    mu_instance.save(
                        update_fields=["status", "updated_at"]
                    )  # Можно добавить is_..._confirmed, если сбрасываете

                signal.markup_assignments_count = 0
                signal.save(
                    update_fields=["markup_assignments_count", "updated_at"]
                )
                messages.success(
                    request,
                    f"Все разметки для сигнала '{signal.original_filename}' отклонены. Сигнал будет доступен для повторной разметки.",
                )
            else:
                try:
                    chosen_markup_id = int(final_choice_value)
                    for mu_instance in all_markups_for_signal:
                        if mu_instance.id == chosen_markup_id:
                            # Статус 'approved' ставится, если ХОТЯ БЫ ОДИН из флагов is_..._confirmed для нее True
                            if (
                                mu_instance.is_markup_annotations_confirmed
                                or mu_instance.is_diagnoses_confirmed
                            ):
                                mu_instance.status = "approved"
                                approved_markup_successfully_set = True
                                # Данные НЕ обнуляются. Флаги is_..._confirmed уже установлены.
                            else:
                                mu_instance.status = "rejected"
                                messages.warning(
                                    request,
                                    f"Разметка (ID: {mu_instance.id}) была выбрана основной, но ни аннотации, ни диагнозы в ней не были подтверждены. Она помечена как отклоненная.",
                                )
                        else:
                            mu_instance.status = "rejected"
                            # Данные НЕ обнуляем. Флаги is_..._confirmed уже установлены.
                        mu_instance.save(
                            update_fields=["status", "updated_at"]
                        )

                    if approved_markup_successfully_set:
                        messages.success(
                            request,
                            f"Валидация для сигнала '{signal.original_filename}' завершена. Разметка (ID: {chosen_markup_id}) утверждена.",
                        )
                    else:
                        # Если выбранная разметка не стала approved, и остальные rejected -> reject_all
                        signal.markup_assignments_count = 0
                        signal.save(
                            update_fields=[
                                "markup_assignments_count",
                                "updated_at",
                            ]
                        )
                        messages.warning(
                            request,
                            f"Валидация для сигнала '{signal.original_filename}' завершена, но ни одна разметка не была утверждена (выбранная разметка не имела подтвержденных частей). Сигнал будет доступен для повторной разметки.",
                        )

                except ValueError:
                    messages.error(
                        request, "Ошибка в выборе финальной разметки."
                    )
                    detailed_markups_data = self.get_detailed_markups_data(
                        all_markups_for_signal
                    )
                    return render(
                        request,
                        self.template_name,
                        {
                            "signal": signal,
                            "formset": formset,
                            "final_decision_form": final_decision_form,
                            "page_title": f"Валидация сигнала: {signal.original_filename}",
                            "detailed_markups_data": detailed_markups_data,
                            "markups_queryset": all_markups_for_signal,
                        },
                    )

            return redirect("markup:validation_queue_list")
        else:
            messages.error(
                request, "Пожалуйста, исправьте ошибки в формах валидации."
            )

            print("------- PerformSignalValidationView POST Data -------")
            print(request.POST)
            print("------- Formset Errors -------")
            if formset.errors:
                for i, form_errors_dict in enumerate(formset.errors):
                    if form_errors_dict: # Если есть ошибки для этой формы
                        form_instance_pk = formset.forms[i].instance.pk if formset.forms[i].instance else "N/A"
                        print(f"Form {i} (Markup PK: {form_instance_pk}): {form_errors_dict}")
            if formset.non_form_errors():
                print(f"Formset Non-form errors: {formset.non_form_errors()}")
            print("------- Final Decision Form Errors -------")
            if final_decision_form.errors:
                print(f"Final Decision Form errors: {final_decision_form.errors.as_json()}")


            detailed_markups_data = self.get_detailed_markups_data(
                markups_for_validation_initial_qs
            )
            return render(
                request,
                self.template_name,
                {
                    "signal": signal,
                    "formset": formset,
                    "final_decision_form": final_decision_form,
                    "page_title": f"Валидация сигнала: {signal.original_filename}",
                    "detailed_markups_data": detailed_markups_data,
                    "markups_queryset": markups_for_validation_initial_qs,
                },
            )


class ViewMarkupDetailReadOnlyView(
    LoginRequiredMixin, UserIsValidatorOrSuperuserMixin, View
):  # pragma: no cover
    template_name = "markup/markup_readonly_detail.html"

    def get(self, request, markup_id, *args, **kwargs):
        try:
            markup = get_object_or_404(
                Markup.objects.select_related(
                    "signal", "marker__user"
                ).prefetch_related("diagnoses__parent"),
                pk=markup_id,
            )
        except Http404:
            messages.error(request, "Запрошенная разметка не найдена.")
            return redirect("markup:validation_queue_list")

        signal_obj = markup.signal

        try:
            ecg_signal_data = np.load(signal_obj.data_file.path).tolist()
        except FileNotFoundError:
            messages.error(
                request,
                f"Файл сигнала ЭКГ ({signal_obj.data_file.name}) не найден.",
            )
            return redirect("markup:validation_queue_list")
        except Exception as e:
            messages.error(request, f"Ошибка при загрузке данных ЭКГ: {e}.")
            return redirect("markup:validation_queue_list")

        diagnoses_paths = []
        for diagnosis in markup.diagnoses.all():
            if diagnosis.parent:
                diagnoses_paths.append(
                    f"{diagnosis.parent.name} | {diagnosis.name}"
                )

        # Определяем URL для возврата
        next_url = request.GET.get("next")
        default_back_url = reverse_lazy(
            "markup:perform_signal_validation",
            kwargs={"signal_id": markup.signal_id},
        )

        if next_url and url_has_allowed_host_and_scheme(
            url=next_url, allowed_hosts={request.get_host()}
        ):
            back_url = next_url
        else:
            back_url = default_back_url
            if next_url:  # Если next был, но небезопасный
                messages.warning(
                    request,
                    "Небезопасный URL для возврата был проигнорирован.",
                )

        context = {
            "page_title": f"Просмотр разметки (ID: {markup.id}) для сигнала: {signal_obj.original_filename}",
            "markup_instance": markup,
            "signal_instance": signal_obj,
            "ecg_data_js": json.dumps(ecg_signal_data),
            "ecg_names_js": json.dumps(common_constants.ECG_LEADS),
            "markup_annotations_js": json.dumps(markup.markup_data or []),
            "selected_diagnoses_paths_js": json.dumps(diagnoses_paths),
            "is_readonly_mode": True,
            "back_url": back_url,  # Передаем безопасный URL для возврата
            "constants_markup_types_js": json.dumps(
                local_constants.MARKUP_TYPES
            ),  # Передаем типы разметки для JS
        }
        return render(request, self.template_name, context)


class MarkupListView(
    LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, ListView
):
    model = Markup
    template_name = "markup/markup_list.html"
    context_object_name = "completed_markups"
    paginate_by = 10

    def get_queryset(self):
        marker_profile = self.request.user.marker_profile

        return Markup.objects.filter(
            marker=marker_profile,
            status__in=[
                "approved",
                "rejected",
                "for_validation",
                "pending_validation",
            ],
        ).order_by("-updated_at")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Мои разметки"

        active_draft_markup = None
        time_left = None

        marker_profile = self.request.user.marker_profile

        current_draft = (
            Markup.objects.filter(marker=marker_profile, status="draft")
            .select_related("signal")
            .order_by("-created_at")
            .first()
        )

        if current_draft:
            if current_draft.is_expired:
                signal_name = current_draft.signal.original_filename

                current_draft.delete()

                messages.warning(
                    self.request,
                    f"Ваш черновик для сигнала '{signal_name}' был просрочен и удален.",
                )
            else:
                active_draft_markup = current_draft
                time_left = active_draft_markup.time_left_for_draft()

        context["active_draft"] = active_draft_markup
        context["time_left_for_draft"] = time_left
        # Чекнуть, нужна ли добавленная проверка
        context["has_marker_profile"] = marker_profile is not None

        return context


class StartNewMarkupView(
    LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, View
):
    @transaction.atomic
    def get(self, request, *args, **kwargs):
        user = request.user
        marker_profile = user.marker_profile

        existing_active_draft = (
            Markup.objects.filter(
                marker=marker_profile,
                status="draft",
                expires_at__isnull=False,
                expires_at__gt=timezone.now(),
            )
            .order_by("-created_at")
            .first()
        )

        if existing_active_draft:
            messages.info(
                request,
                "У вас уже есть активная разметка сигнала. Пожалуйста, завершите её.",
            )
            return redirect(
                "markup:perform_markup", markup_id=existing_active_draft.id
            )

        signals_completed_by_user_ids = (
            Markup.objects.filter(marker=marker_profile)
            .exclude(status="rejected")
            .values_list("signal_id", flat=True)
            .distinct()
        )

        potential_signals = (
            Signal.objects.exclude(id__in=signals_completed_by_user_ids)
            .filter(markup_assignments_count__lt=Signal.MAX_MARKUP_ASSIGNMENTS)
            .order_by("-markup_assignments_count", "created_at")
        )

        signal_to_markup = potential_signals.first()

        if not signal_to_markup:
            messages.info(
                request,
                "Нет доступных сигналов для новой разметки, подходящих под критерии.",
            )
            return redirect("markup:markup_list")

        new_markup = Markup.objects.create(
            signal=signal_to_markup,
            marker=marker_profile,
            markup_data=[],
            status="draft",
            expires_at=timezone.now() + timedelta(hours=12),
        )

        messages.success(
            request,
            f"Начата разметка сигнала с id={signal_to_markup.id}. "
            "У вас есть 12 часов на её завершение.",
        )
        messages.warning(
            request,
            "Нейронная сеть выполнила предварительную разметку."
            "Откорректируйте её результаты для более точной разметки",
        )
        return redirect("markup:perform_markup", markup_id=new_markup.pk)


class PerformMarkupView(
    LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, View
):
    template_name = "markup/markup.html"

    def get_markup_or_handle_error(self, request, markup_id):
        """
        Вспомогательный метод для получения и валидации объекта Markup.
        Вызывается как в GET, так и в POST запросах.
        Возвращает (markup_instance, None) при успехе или (None, redirect_response) при ошибке.
        """
        try:
            markup = Markup.objects.select_related("signal").get(
                pk=markup_id, marker=request.user.marker_profile
            )
        except Markup.DoesNotExist:
            messages.error(
                request,
                "Разметка не найдена или у вас нет прав на её редактирование.",
            )
            return None, redirect("markup:markup_list")

        # Проверка статуса разметки. Редактировать можно только черновики со статусом draft.
        if markup.status != "draft":
            messages.warning(request, "Разметка не может быть изменена.")
            return None, redirect("markup:markup_list")

        # Проверка, не истек ли срок действия черновика.
        if markup.is_expired:
            signal_name = markup.signal.original_filename

            with transaction.atomic():
                markup.delete()
            messages.error(
                request,
                f"Срок действия вашего черновика для сигнала '{signal_name}' истек."
                "Он был удален. Пожалуйста, начните новую разметку."
            )
            return None, redirect("markup:markup_list")

        return markup, None

    def get(self, request, markup_id, *args, **kwargs):
        """Обработка GET-запроса для отображения страницы разметки."""
        markup, error_redirect = self.get_markup_or_handle_error(
            request, markup_id
        )
        if error_redirect:
            return error_redirect
        if not markup:
            return redirect("markup:markup_list")

        signal_obj = markup.signal

        try:
            ecg_signal_data = np.load(signal_obj.data_file.path)
        except FileNotFoundError:
            messages.error(
                request,
                f"Файл сигнала ЭКГ ({signal_obj.data_file.name}) не найден. Разметка не может быть отображена.",
            )
            return redirect("markup:markup_list")
        except Exception as e:
            messages.error(
                request,
                f"Ошибка при загрузке или обработке данных ЭКГ: {e}. Разметка не может быть отображена.",
            )
            return redirect("markup:markup_list")

        try:
            if not markup.markup_data:
                # Сохраняем предразметку нейронной сети для предотвращения вызова метода предсказания каждый GET запрос
                markups = unet_ecg.predict(ecg_signal_data)
                markup.markup_data = markups
                markup.save()
        except Exception as e:
            messages.error(
                request,
                f"Ошибка при предварительной разметке данных нейронной сетью: {e}"
            )

        context = {
            "page_title": f"Разметка сигнала: {signal_obj.original_filename}",  # Заголовок страницы
            "markup_id": markup.id,  # ID текущего черновика (для JS и URL формы)
            "signal_id": signal_obj.id,  # ID сигнала (может быть полезно для JS)
            "data": ecg_signal_data.tolist(),
            "ecg_names": common_constants.ECG_LEADS,
            "markups": markup.markup_data or [],
            "markup_types": local_constants.MARKUP_TYPES,
            "markup_expires_at_iso": (
                markup.expires_at.isoformat() if markup.expires_at else None
            ),
            # URL, на который будет отправлена форма валидации (POST-запрос к этому же view)
            "submit_validation_url": request.path,  # request.path содержит текущий URL
        }
        return render(request, self.template_name, context)

    @transaction.atomic
    def post(self, request, markup_id, *args, **kwargs):
        """Обработка POST-запроса для отправки разметки на валидацию."""
        markup, error_redirect = self.get_markup_or_handle_error(
            request, markup_id
        )
        if error_redirect:
            return error_redirect
        if not markup:
            return redirect("markup:markup_list")

        # Получение данных из формы
        markup_data_str = request.POST.get("markup_data", [])
        selected_diagnoses_paths_str = request.POST.get("diagnoses_data", [])

        # 1. Валидация данных разметки (аннотаций ЭКГ)
        try:
            markup_data_json = json.loads(markup_data_str)
            if not isinstance(markup_data_json, list):
                # Здесь можно добавить более глубокую валидацию структуры каждого объекта в массиве,
                # например, проверку наличия и типов ключей "type", "x0", "x1".
                raise ValueError(
                    "Данные разметки (markup_data) должны быть JSON-массивом объектов."
                )
        except (json.JSONDecodeError, ValueError) as e:
            messages.error(
                request,
                f"Ошибка в формате данных разметки: {e}. Пожалуйста, попробуйте снова.",
            )
            return redirect("markup:perform_markup", markup_id=markup_id)

        # 2. Обработка и валидация выбранных диагнозов
        diagnosis_instances = []
        has_diagnosis_errors = False

        try:
            # Данные диагнозов должны прийти как JSON-строка, представляющая массив строк
            # формата "Родитель | Потомок".
            selected_diagnoses_paths_list = json.loads(
                selected_diagnoses_paths_str
            )

            if not isinstance(selected_diagnoses_paths_list, list):
                raise ValueError(
                    "Данные диагнозов должны быть JSON-массивом строк."
                )
        except (json.JSONDecodeError, ValueError) as e:
            messages.error(
                request,
                f"Ошибка в формате данных диагнозов: {e}. Пожалуйста, попробуйте снова.",
            )
            return redirect("markup:perform_markup", markup_id=markup_id)

        for path_str in selected_diagnoses_paths_list:
            # Проверка формата каждой строки диагноза
            if not isinstance(path_str, str) or " | " not in path_str:
                messages.error(
                    request,
                    f"Некорректный формат для пути диагноза: '{path_str}'.",
                )
                has_diagnosis_errors = True
                continue

            parts = path_str.split(" | ")
            parent_name = parts[0].strip()
            child_name = parts[1].strip() if len(parts) > 1 else ""

            if not child_name:
                messages.error(
                    request,
                    f"Некорректный формат для пути диагноза (отсутствует дочерний диагноз): '{path_str}'.",
                )
                has_diagnosis_errors = True
                continue
            try:
                diagnosis = Diagnosis.objects.get(
                    name=child_name, parent__name=parent_name
                )
                diagnosis_instances.append(diagnosis)
            except Diagnosis.DoesNotExist:
                messages.error(
                    request,
                    f"Диагноз не найден в базе данных: '{child_name}' (родитель: '{parent_name}')."
                    "Возможно, структура диагнозов на клиенте устарела или содержит ошибку."
                )
                has_diagnosis_errors = True

        if has_diagnosis_errors:
            messages.warning(
                request,
                "Разметка не была отправлена на валидацию из-за ошибок в диагнозах."
                "Пожалуйста, проверьте выбранные диагнозы и попробуйте снова."
            )
            return redirect("markup:perform_markup", markup_id=markup_id)

        # 3. Обновление объекта Markup и сохранение в базе данных

        markup.markup_data = markup_data_json
        markup.diagnoses.set(diagnosis_instances)
        markup.status = "pending_validation"
        markup.expires_at = None
        markup.save()

        messages.success(
            request,
            f"Разметка для сигнала '{markup.signal.original_filename}' успешно отправлена на валидацию.",
        )
        return redirect("markup:markup_list")


class SignalUploadView(
    LoginRequiredMixin, UserIsSupplierOrSuperuserMixin, CreateView
):
    model = Signal
    form_class = SignalUploadForm
    template_name = "markup/upload_files.html"
    success_url = reverse_lazy("markup:signal_upload")

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["supplier"] = self.request.user.supplier_profile
        return kwargs

    def form_valid(self, form):
        try:
            # return super().form_valid(form)
            instances = form.save()
            success_count = len(instances)
            total_files = form.total_files

            if success_count < total_files:
                messages.warning(
                    self.request,
                    f"Загружено {success_count}/{total_files} файлов (некоторые были пропущены)",
                )
            else:
                messages.success(self.request, "Все файлы успешно загружены")

            return redirect("markup:signal_upload")

        except Exception as e:
            messages.error(
                self.request, f"Ошибка при загрузке файлов: {str(e)}"
            )
            return self.form_invalid(form)


# @require_POST
# def submit_validation(request):
#     markup_data = request.POST.get("markup_data", "[]")
#     diagnoses_data = request.POST.get("diagnoses_data", "[]")

#     try:
#         markups = json.loads(markup_data)
#         diagnoses = json.loads(diagnoses_data)
#         # проверим, насколько верны пришедшие данные
#         # проверим длину данных на сервере

#     except json.JSONDecodeError:
#         return HttpResponseBadRequest("Неверный формат данных")

#     return render(
#         request,
#         "markup/check_validation.html",
#         context={"markups": markups or [], "diagnoses": diagnoses or []},
#     )


# def save_diagnoses(request):
#     if request.method == "POST":
#         selected_paths = request.POST.getlist("diagnoses")
#         selected_ids = []

#         for path in selected_paths:
#             parent_name, child_name = path.split(" | ")

#             try:
#                 disease = Diagnosis.objects.get(
#                     name=child_name, parent__name=parent_name
#                 )
#                 selected_ids.append(disease)

#             except Diagnosis.DoesNotExist:
#                 messages.error(
#                     request,
#                     f"Диагноз не найден: '{child_name}' (родитель: '{parent_name or 'нет'}')",
#                 )
#                 continue


#     return render(
#         request,
#         "markup/list_diseases.html",
#         context={"selected_ids": selected_ids},
#    )


# def save_markup(request):
#     markup = None
#     if request.method == "POST":
#         try:
#             json_str = request.POST.get("markup_data", "{}")
#             markup = json.loads(json_str)

#         except json.JSONDecodeError:
#             return HttpResponseBadRequest("Невалидный JSON в markup_data")

#     return render(
#         request, "markup/check_markup.html", context={"markup": markup}
#     )
