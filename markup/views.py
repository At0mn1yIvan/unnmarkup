import numpy as np
import json
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

# Create your views here.


@login_required
def markup(request):
    data = np.load("media/vanya.npy").tolist()
    names = [
        "I",
        "II",
        "III",
        "AVR",
        "AVL",
        "AVF",
        "V1",
        "V2",
        "V3",
        "V4",
        "V5",
        "V6",
    ]
    with open("media/diseases.json", "r", encoding="utf-8") as f:
        diseases = json.load(f)
    return render(
        request,
        "markup/markup.html",
        context={
            "data": data,
            "names": names,
            "diseases_json": json.dumps(diseases, ensure_ascii=False),
        },
    )
