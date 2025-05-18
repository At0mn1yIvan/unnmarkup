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

    # Загрузка дерева диагнозов для отрисовки
    with open("media/diagnoses.json", "r", encoding="utf-8") as f:
        diseases = json.load(f)

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
            "diseases_json": diseases,
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


class SignalUploadView(LoginRequiredMixin, UserIsSupplierOrSuperuserMixin, CreateView):
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
