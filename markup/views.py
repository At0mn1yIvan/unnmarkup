import json

import numpy as np
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_POST

from . import constants
from .models import Diagnose


@login_required
def markup(request):
    data = np.load("media/vanya.npy").tolist()

    with open("media/diseases.json", "r", encoding="utf-8") as f:
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
        # проверим, наскорлько верны пришедшие данные
        # проверим длину данных на сервере

    except json.JSONDecodeError:
        return HttpResponseBadRequest("Неверный формат данных")

    return render(
        request,
        "markup/check_validation.html",
        context={"markups": markups or [], "diagnoses": diagnoses or []}
    )


def save_diagnoses(request):
    if request.method == "POST":
        selected_paths = request.POST.getlist("diagnoses")
        selected_ids = []

        for path in selected_paths:
            parent_name, child_name = path.split(" | ")

            try:
                disease = Diagnose.objects.get(
                    name=child_name, parent__name=parent_name
                )
                selected_ids.append(disease)

            except Diagnose.DoesNotExist:
                messages.error(
                    request,
                    f"Диагноз не найден: '{child_name}' (родитель: '{parent_name or 'нет'}')",
                )
                continue

    return render(
        request,
        "markup/list_diseases.html",
        context={"selected_ids": selected_ids},
    )


def save_markup(request):
    markup = None
    if request.method == "POST":
        try:
            json_str = request.POST.get("markup_data", "{}")
            markup = json.loads(json_str)

        except json.JSONDecodeError:
            return HttpResponseBadRequest("Невалидный JSON в markup_data")

    return render(
        request, "markup/check_markup.html", context={"markup": markup}
    )
