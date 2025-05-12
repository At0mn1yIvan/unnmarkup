import json

import numpy as np
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.views.generic import CreateView, ListView

from . import constants
from .forms import SignalUploadForm
from .models import Diagnosis, Signal


@login_required
def markup(request):
    data = np.load("media/vanya.npy").tolist()

    with open("media/diagnoses.json", "r", encoding="utf-8") as f:
        diseases = json.load(f)

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
        context={"markups": markups or [], "diagnoses": diagnoses or []}
    )


class SignalUploadView(CreateView, ListView):
    model = Signal
    form_class = SignalUploadForm
    template_name = 'signals/upload_files.html'
    context_object_name = 'signals'
    success_url = '/upload/'

    def get_queryset(self):
        return Signal.objects.filter(
            supplier=self.request.user.supplier_profile
        ).order_by('-created_at')

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs['supplier'] = self.request.user.supplier_profile
        return kwargs

    def form_valid(self, form):
        try:
            file = self.request.FILES['data']
            form.instance.original_filename = file.name
            form.instance.data = json.load(file)

            if self.request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                signal = form.save()
                return JsonResponse({
                    'status': 'success',
                    'filename': file.name,
                    'date': signal.created_at.strftime("%d.%m.%Y %H:%M"),
                    'sample_rate': signal.sample_rate
                })
            
            return super().form_valid(form)
            
        except json.JSONDecodeError:
            form.add_error('data', 'Некорректный формат JSON')
            return self.form_invalid(form)

    def form_invalid(self, form):
        if self.request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'errors': form.errors}, status=400)
        return super().form_invalid(form)

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
