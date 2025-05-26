import json
from datetime import timedelta

import numpy as np
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.http import HttpResponseBadRequest, HttpResponseRedirect
from django.shortcuts import redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.views import View
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, ListView

from . import constants
from .forms import SignalUploadForm
from .mixins import UserIsMarkerOrSuperuserMixin, UserIsSupplierOrSuperuserMixin
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


class MarkupListView(LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, ListView):
    model = Markup
    template_name = "markup/markup_list.html"
    context_object_name = "completed_markups"
    paginate_by = 10

    def get_queryset(self):
        user = self.request.user
        marker_profile = user.marker_profile

        return Markup.objects.filter(
            marker=marker_profile,
            status__in=["approved", "rejected", "for_validation"],
        ).order_by("-updated_at")

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
                .select_related("signal")
                .order_by("-created_at")
                .first()
            )

            if current_draft:
                if current_draft.is_expired():
                    signal_name = current_draft.signal.original_filename

                    current_draft.delete()

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


class StartNewMarkupView(LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, View):
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
            return redirect("perform_markup", markup_id=existing_active_draft.id)

        signals_completed_by_user_ids = (
            Markup.objects.filter(marker=marker_profile)
            .exclude(status="rejected")
            .values_list("signal_id", flat=True)
            .distinct()
        )

        potential_signals = (
            Signal.objects.exclude(id__in=signals_completed_by_user_ids)
            .filter(markup_assignments_count__lt=Signal.MAX_MARKUP_ASSIGNMENTS)
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

        messages.success(
            request,
            f"Начата разметка для сигнала '{signal_to_markup.original_filename}'. "
            f"У вас есть примерно 12 часов на её завершение.",
        )
        return redirect("markup:perform_markup", markup_id=new_markup.pk)


class PerformMarkupView(LoginRequiredMixin, UserIsMarkerOrSuperuserMixin, View):
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
        if markup.is_expired():
            signal_name = markup.signal.original_filename

            with transaction.atomic():
                markup.delete()
            messages.error(
                request,
                f"Срок действия вашего черновика для сигнала '{signal_name}' истек. Он был удален. Пожалуйста, начните новую разметку.",
            )
            return None, redirect("markup:markup_list")

        return markup, None

    def get(self, request, markup_id, *args, **kwargs):
        """Обработка GET-запроса для отображения страницы разметки."""
        markup, error_redirect = self.get_markup_or_handle_error(request, markup_id)
        if error_redirect:
            return error_redirect
        if not markup:
            return redirect("markup:markup_list")

        signal_obj = markup.signal

        try:
            ecg_signal_data = np.load(signal_obj.data_file.path).tolist()
        except FileNotFoundError:
            messages.error(
                request,
                f"Файл сигнала ЭКГ ({signal_obj.data_file.name}) не найден. Разметка не может быть отображена.",
            )
            return redirect("markup:markup_list")
        except (
            Exception
        ) as e:
            messages.error(
                request,
                f"Ошибка при загрузке или обработке данных ЭКГ: {e}. Разметка не может быть отображена.",
            )
            return redirect("markup:markup_list")

        context = {
            "page_title": f"Разметка сигнала: {signal_obj.original_filename}",  # Заголовок страницы
            "markup_id": markup.id,  # ID текущего черновика (для JS и URL формы)
            "signal_id": signal_obj.id,  # ID сигнала (может быть полезно для JS)
            # Данные для {{ data|json_script:"ecgData" }} в шаблоне
            "data": ecg_signal_data,
            # Данные для {{ ecg_names|json_script:"ecgNames" }}
            "ecg_names": constants.ECG_LEADS,
            "markups": [],  # Или markup.markup_data, если хотите передать сохраненное состояние из БД (но IndexedDB может его переопределить)
            # Типы разметки для радиокнопок выбора инструмента (P, QRS, T, Noise)
            "markup_types": constants.MARKUP_TYPES,
            # Время истечения черновика в ISO формате для использования в JS (например, для таймера)
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
        markup, error_redirect = self.get_markup_or_handle_error(request, markup_id)
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
            selected_diagnoses_paths_list = json.loads(selected_diagnoses_paths_str)

            if not isinstance(selected_diagnoses_paths_list, list):
                raise ValueError("Данные диагнозов должны быть JSON-массивом строк.")
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
                    request, f"Некорректный формат для пути диагноза: '{path_str}'."
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
                    f"Диагноз не найден в базе данных: '{child_name}' (родитель: '{parent_name}'). Возможно, структура диагнозов на клиенте устарела или содержит ошибку.",
                )
                has_diagnosis_errors = True

        if has_diagnosis_errors:
            messages.warning(
                request,
                "Разметка не была отправлена на валидацию из-за ошибок в диагнозах. Пожалуйста, проверьте выбранные диагнозы и попробуйте снова.",
            )
            return redirect("markup:perform_markup", markup_id=markup_id)

        # 3. Обновление объекта Markup и сохранение в базе данных

        # TODO проверяем!

        # with open("media/markup_to_check.json", "w", encoding="utf-8") as f:
        #     json.dump(markup_data_json, f, ensure_ascii=False)

        # with open("media/diagnoses_id.txt", "w", encoding="utf-8") as f:
        #     for s in diagnosis_instances:
        #         f.write(str(s.id) + "\n")

        markup.markup_data = markup_data_json
        markup.diagnoses.set(diagnosis_instances)
        markup.status = "for_validation"
        markup.expires_at = None
        markup.save()

        messages.success(
            request,
            f"Разметка для сигнала '{markup.signal.original_filename}' успешно отправлена на валидацию.",
        )
        return redirect("markup:markup_list")


class SignalUploadView(LoginRequiredMixin, UserIsSupplierOrSuperuserMixin, CreateView):
    model = Signal
    form_class = SignalUploadForm
    template_name = "markup/upload_files.html"
    success_url = reverse_lazy("markup:signal_upload")

    # def dispatch(self, request, *args, **kwargs):
    #     if not (request.user.is_superuser or request.user.role == "user_supplier"):
    #         raise PermissionDenied
    #     return super().dispatch(request, *args, **kwargs)

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
            # return HttpResponseRedirect(self.success_url)

            return redirect("markup:signal_upload")

        except Exception as e:
            messages.error(self.request, f"Ошибка при загрузке файлов: {str(e)}")
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
