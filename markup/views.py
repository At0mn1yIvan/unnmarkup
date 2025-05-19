import json
from datetime import timedelta

import numpy as np
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ObjectDoesNotExist, PermissionDenied
from django.db import transaction
from django.db.models import F
from django.http import (HttpResponseBadRequest, HttpResponseRedirect,
                         JsonResponse)
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, FormView, ListView

from . import constants
from .forms import SignalUploadForm
from .mixins import (UserIsMarkerOrSuperuserMixin,
                     UserIsSupplierOrSuperuserMixin)
from .models import Diagnosis, Markup, Signal


@login_required
# Ставим ограничение на суперпользователя и разметчика
# Перепишем под CBV вместо функции
def markup(request):
    # Создание записи Markup здесь или отдельной функцией в классе

    # Тут необходимо выдать signal.data_file и прочитать его через np.load().tolist()
    data = np.load("media/vanya.npy").tolist()

    # TODO плейсхолдер для ответа нейронной сети
    with open("media/markup.json", "r", encoding="utf-8") as f:
        markups = json.load(f)

    return render(
        request,
        "markup/markup.html",
        context={
            "data": data,
            "ecg_names": constants.ECG_LEADS,
            "markup_types": constants.MARKUP_TYPES,
            "markups": markups,
        },
    )


class MarkupListView(
    LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, ListView
):
    model = Markup
    template_name = (
        "markup/markup_list.html"  # Вам нужно будет создать этот шаблон
    )
    context_object_name = "completed_markups"
    paginate_by = 10

    def get_queryset(self):
        user = self.request.user
        # try:
        marker_profile = user.marker_profile
        # Выбираем только те статусы, которые должны быть в основном списке
        return Markup.objects.filter(
            marker=marker_profile,
            status__in=["approved", "rejected", "for_validation"],
        ).order_by("-updated_at")
        # except (ObjectDoesNotExist, AttributeError):
        #     messages.error(
        #         self.request,
        #         "Профиль маркировщика не найден. Обратитесь к администратору.",
        #     )
        #     return Markup.objects.none()

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["page_title"] = "Мои разметки"

        active_draft_markup = None
        time_left = None
        has_profile = False

        try:
            marker_profile = self.request.user.marker_profile
            has_profile = True

            current_draft = (
                Markup.objects.filter(marker=marker_profile, status="draft")
                .order_by("-created_at")
                .first()
            )

            if current_draft:
                if current_draft.is_expired():
                    signal_to_update = current_draft.signal
                    signal_name = current_draft.signal.original_filename
                    current_draft.delete()

                    Signal.objects.filter(
                        pk=signal_to_update.pk, markup_assignments_count__gt=0
                    ).update(
                        markup_assignments_count=F("markup_assignments_count")
                        - 1
                    )

                    messages.warning(
                        self.request,
                        f"Ваш черновик для сигнала '{signal_name}' был просрочен и удален.",
                    )
                else:
                    active_draft_markup = current_draft
                    time_left = active_draft_markup.time_left_for_draft()

        except (ObjectDoesNotExist, AttributeError):
            pass

        context["active_draft"] = active_draft_markup
        context["time_left_for_draft"] = time_left
        context["has_marker_profile"] = has_profile

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
                "perform_markup", markup_id=existing_active_draft.id
            )

        signals_completed_by_user_ids = (
            Markup.objects.filter(marker=marker_profile)
            .exclude(status="rejected")
            .values_list("signal_id", flat=True)
            .distinct()
        )

        potential_signals = (
            Signal.objects.exclude(id__in=signals_completed_by_user_ids)
            .filter(markup_assigments_count__lt=Signal.MAX_MARKUP_ASSIGNMENTS)
            .order_by("markup_assignments_count", "created_at")
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

        Signal.objects.filter(pk=signal_to_markup.pk).update(
            markup_assignments_count=F("markup_assignments_count") + 1
        )

        messages.success(
            request,
            f"Начата разметка для сигнала '{signal_to_markup.original_filename}'. "
            f"У вас есть примерно 12 часов на её завершение.",
        )
        return redirect("perform_markup", markup_id=new_markup.pk)


# class PerformMarkupView(
#     LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, View
# ):
#     template_name = "markup/perform_markup_form.html"

#     def get_markup_or_handle_error(self, request, markup_id):
#         """Вспомогательный метод для получения и проверки объекта Markup."""
#         try:
#             # Убедимся, что маркировщик может редактировать только свои разметки
#             markup = Markup.objects.select_related("signal").get(
#                 pk=markup_id, marker=request.user.marker_profile
#             )
#         except Markup.DoesNotExist:
#             messages.error(
#                 request,
#                 "Разметка не найдена или у вас нет прав на её редактирование.",
#             )
#             return None, redirect("markup:markup_list")

#         if markup.status != "draft":
#             messages.warning(
#                 request,
#                 f"Разметка не может быть отредактирована как черновик.",
#             )
#             return None, redirect("markup:markup_list")

#         if markup.is_expired():
#             signal_to_update = markup.signal
#             signal_name = signal_to_update.original_filename

#             with transaction.atomic():
#                 markup.delete()
#                 Signal.objects.filter(
#                     pk=signal_to_update.pk, markup_assignments_count__gt=0
#                 ).update(
#                     markup_assignments_count=F("markup_assignments_count") - 1
#                 )

#             messages.error(
#                 request,
#                 f"Срок действия вашего черновика для сигнала '{signal_name}' истек, и он был удален. Пожалуйста, начните новую разметку.",
#             )
#             return None, redirect("markup:markup_list")

#         return markup, None

#     def get(self, request, markup_id, *args, **kwargs):
#         markup, error_redirect = self.get_markup_or_handle_error(
#             request, markup_id
#         )
#         if error_redirect:
#             return error_redirect

#         signal = markup.signal

#         try:
#             ecg_signal_data = np.load(signal.data_file.path).tolist()
#         except FileNotFoundError:
#             messages.error(
#                 request, f"Файл сигнала ЭКГ не найден: {signal.data_file.name}"
#             )
#             return redirect("markup:markup_list")
#         except Exception as e:
#             messages.error(request, f"Ошибка при загрузке данных ЭКГ: {e}")
#             return redirect("markup:markup_list")

#         # # Подготовка выбранных диагнозов для отображения в форме
#         # selected_diagnoses_paths = []
#         # for diag in markup.diagnoses.select_related('parent').all():
#         #     if diag.parent: # Только если есть родитель, т.к. мы сохраняем "Родитель | Потомок"
#         #         selected_diagnoses_paths.append(f"{diag.parent.name} | {diag.name}")

#         context = {
#             "page_title": f"Разметка сигнала: {signal.original_filename}",
#             "markup": markup,
#             "signal": signal,
#             "data": ecg_signal_data,
#             "ecg_names": constants.ECG_LEADS,
#             "markup_types": constants.MARKUP_TYPES,
#             # 'diagnoses_choices': get_diagnosis_choices(),
#             "current_markup_data_json": json.dumps(
#                 markup.markup_data or []
#             ),  # если markup_data может быть None
#             # 'selected_diagnoses_paths': selected_diagnoses_paths,
#             "time_left_for_draft_str": (
#                 str(markup.time_left_for_draft()).split(".")[0]
#                 if markup.time_left_for_draft()
#                 else None
#             ),  # Форматируем для отображения
#         }
#         return render(request, self.template_name, context)

#     @transaction.atomic
#     def post(self, request, markup_id, *args, **kwargs):
#         markup, error_redirect = self.get_markup_or_handle_error(request, markup_id)
#         if error_redirect:
#             return error_redirect

#         signal = markup.signal

#         markup_data_str = request.POST.get('markup_data')
#         selected_diagnoses_paths = request.POST.getlist('diagnoses')
#         action = request.POST.get('action', 'submit_for_validation')

#         # Валидация данных разметки (JSON)
#         try:
#             markup_data_json = json.loads(markup_data_str) if markup_data_str else []
#             if not isinstance(markup_data_json, list):
#                 raise ValueError("Данные разметки (markup_data) должны быть списком.")
#         except (json.JSONDecodeError, ValueError) as e:
#             messages.error(request, f"Ошибка в данных разметки: {e}")
#             # Перерисовка формы с ошибкой, сохраняя введенные данные
#             context = self._get_error_context(request, markup, markup_data_str, selected_diagnoses_paths)
#             return render(request, self.template_name, context)

#         # Обработка и валидация диагнозов
#         diagnosis_instances = []
#         has_diagnosis_errors = False
#         for path in selected_diagnoses_paths:
#             try:
#                 parent_name, child_name = path.split(" | ")
#                 parent_name = parent_name.strip()
#                 child_name = child_name.strip()
#                 diagnosis = Diagnosis.objects.get(name=child_name, parent__name=parent_name)
#                 diagnosis_instances.append(diagnosis)
#             except Diagnosis.DoesNotExist:
#                 messages.error(request, f"Диагноз не найден: '{child_name}' (родитель: '{parent_name}').")
#                 has_diagnosis_errors = True
#             except ValueError:
#                 messages.error(request, f"Некорректный формат для пути диагноза: '{path}'.")
#                 has_diagnosis_errors = True

#         if has_diagnosis_errors:
#             messages.warning(request, "Разметка не была сохранена из-за ошибок в диагнозах. Пожалуйста, исправьте их.")
#             context = self._get_error_context(request, markup, markup_data_str, selected_diagnoses_paths)
#             return render(request, self.template_name, context)

#         # Обновление объекта Markup
#         markup.markup_data = markup_data_json
#         markup.diagnoses.set(diagnosis_instances) # .set() правильно обработает M2M

#         if action == "save_draft":
#             markup.status = "draft"
#             # Можно обновить expires_at, если хотите продлить время на черновик при каждом сохранении
#             # markup.expires_at = timezone.now() + timedelta(hours=12) 
#             markup.save()
#             messages.success(request, f"Черновик для сигнала '{signal.original_filename}' успешно сохранен.")
#             return redirect("markup:perform_markup", markup_id=markup.id) # Остаемся на той же странице

#         elif action == "submit_for_validation":
#             markup.status = "for_validation"
#             markup.expires_at = None  # Черновик больше не действителен по времени
#             markup.save()
#             messages.success(request, f"Разметка для сигнала '{signal.original_filename}' успешно отправлена на валидацию.")
#             return redirect("markup:markup_list")

#         else:
#             messages.error(request, "Неизвестное действие.")
#             context = self._get_error_context(request, markup, markup_data_str, selected_diagnoses_paths)
#             return render(request, self.template_name, context)

#     def _get_error_context(self, request, markup_obj, submitted_markup_data_str, submitted_diagnoses_paths):
#         """Вспомогательный метод для подготовки контекста при ошибках POST."""
#         signal = markup_obj.signal
#         try:
#             ecg_signal_data = np.load(signal.data_file.path).tolist()
#         except: # Лучше ловить конкретные исключения
#             ecg_signal_data = [] # Или обработать ошибку более строго
#             messages.error(request, "Не удалось перезагрузить данные ЭКГ для формы.")

#         return {
#             'page_title': f"Разметка сигнала: {signal.original_filename}",
#             'markup': markup_obj,
#             'signal': signal,
#             'ecg_data': ecg_signal_data,
#             'ecg_leads': constants.ECG_LEADS,
#             'markup_types': constants.MARKUP_TYPES,
#             'diagnoses_choices': get_diagnosis_choices(),
#             'current_markup_data_json': submitted_markup_data_str or json.dumps(markup_obj.markup_data or []),
#             'selected_diagnoses_paths': submitted_diagnoses_paths,
#             'time_left_for_draft_str': str(markup_obj.time_left_for_draft()).split('.')[0] if markup_obj.time_left_for_draft() else None,
#         }


# def get_diagnosis_choices():
#     """
#     Подготавливает варианты диагнозов для шаблона.
#     Возвращает список словарей: [{"value": "Имя Родителя | Имя Потомка", "display": "Имя Родителя – Имя Потомка"}]
#     """
#     # Только диагнозы, имеющие родителя, могут быть выбраны в формате «Родитель | Потомок»
#     child_diagnoses = Diagnosis.objects.filter(parent__isnull=False).select_related('parent').order_by('parent__name', 'name')
#     choices = []
#     for diag in child_diagnoses:
#         choices.append({
#             "value": f"{diag.parent.name} | {diag.name}",
#             "display": f"{diag.parent.name} – {diag.name}"
#         })
#     return choices


@require_POST
def submit_validation(request):
    markup_data = request.POST.get("markup_data", "[]")
    diagnoses_data = request.POST.get("diagnoses_data", "[]")

    try:
        markups = json.loads(markup_data)
        diagnoses = json.loads(diagnoses_data)
        # проверим, насколько верны пришедшие данные
        # проверим длину данных на сервере

    except json.JSONDecodeError:
        return HttpResponseBadRequest("Неверный формат данных")

    return render(
        request,
        "markup/check_validation.html",
        context={"markups": markups or [], "diagnoses": diagnoses or []},
    )


class SignalUploadView(
    LoginRequiredMixin, UserIsSupplierOrSuperuserMixin, CreateView
):
    model = Signal
    form_class = SignalUploadForm
    template_name = "markup/upload_files.html"
    success_url = reverse_lazy("markup:signal_upload")

    def dispatch(self, request, *args, **kwargs):
        if not (
            request.user.is_superuser or request.user.role == "user_supplier"
        ):
            raise PermissionDenied
        return super().dispatch(request, *args, **kwargs)

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

            # Перенаправляем с использованием success_url
            return HttpResponseRedirect(self.success_url)

        except Exception as e:
            messages.error(
                self.request, f"Ошибка при загрузке файлов: {str(e)}"
            )
            return self.form_invalid(form)


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
