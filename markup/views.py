from django.http import HttpResponseBadRequest
import numpy as np
import json
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import render

from .models import Diseases
from . import constants


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


def save_diagnoses(request):
    if request.method == "POST":
        selected_paths = request.POST.getlist("diagnoses")
        selected_ids = []

        for path in selected_paths:
            parent_name, child_name = path.split(" | ")

            try:
                disease = Diseases.objects.get(
                    name=child_name, parent__name=parent_name
                )
                selected_ids.append(disease)

            except Diseases.DoesNotExist:
                messages.error(
                    request,
                    f"Диагноз не найден: '{child_name}' (родитель: '{parent_name or 'нет'}')",
                )
                continue

    return render(
        request, "markup/list_diseases.html", context={"selected_ids": selected_ids}
    )


def save_markup(request):
    markup = None
    if request.method == "POST":
        try:
            json_str = request.POST.get("markup_data", "{}")
            markup = json.loads(json_str)

        except json.JSONDecodeError:
            return HttpResponseBadRequest("Невалидный JSON в markup_data")

    return render(request, "markup/check_markup.html", context={"markup": markup})
