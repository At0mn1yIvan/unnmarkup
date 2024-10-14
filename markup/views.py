import numpy as np
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

# Create your views here.


@login_required
def markup(request):
    data = np.load("media/vanya.npy").tolist()
    names = ["I", "II", "III", "AVR", "AVL", "AVF", "V1", "V2", "V3", "V4", "V5", "V6"]
    return render(request, "markup/markup.html", context={"data": data, "names": names})
