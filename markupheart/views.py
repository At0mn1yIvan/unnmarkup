from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse, HttpResponseNotFound, Http404
from django.shortcuts import render
from django.views.generic import ListView, TemplateView
import numpy as np
from markupheart.utils import DataMixin


# Create your views here.


@login_required
def markup(request):
    data = np.load("media/vanya.npy").tolist()
    names = ["I", "II", "III", "AVR", "AVL", "AVF", "V1", "V2", "V3", "V4", "V5", "V6"]
    return render(
        request, "markupheart/markup.html", context={"data": data, "names": names}
    )


class MarkupheartHome(DataMixin, TemplateView):
    template_name = "markupheart/index.html"
    title_page = "Главная страница сайта"

    """def get_context_data(self, **kwargs):
        context = super().get_context_data()
        return self.get_mixin_context(context, title)"""


class MarkupheartAbout(LoginRequiredMixin, DataMixin, TemplateView):
    template_name = "markupheart/about.html"
    title_page = "О сайте"


class MarkupheartMarkup(LoginRequiredMixin, DataMixin, TemplateView):
    template_name = "markupheart/markup.html"
    title_page = "Разметка кардиограммы"


class MarkupheartLogin(DataMixin, TemplateView):
    template_name = "markupheart/login.html"
    title_page = "Войти"


def page_not_found(request, exception):
    return HttpResponseNotFound("<h1>Страница не найдена</h1>")


"""
def index(request):
    # return HttpResponse("Страница приложения Markup.")
    data = {'title': 'Главная страница сайта',
            'menu': menu,
            }
    return render(request, template_name='markupheart/index.html', context=data)"""

"""def about(request):
    data = {'title': 'О сайте',
            'menu': menu,
            }
    return render(request, template_name='markupheart/about.html', context=data)"""

"""def markup(request):
    data = {'title': 'Разметка кардиограммы',
            'menu': menu,
            }
    return render(request, template_name='markupheart/markup.html', context=data)
"""

"""def login(request):
    data = {'title': 'Войти',
            'menu': menu,
            }
    return render(request, template_name='markupheart/login.html', context=data)"""

"""def archive(request, year):
    if year > 2024:
        raise Http404()
    return HttpResponse(f"Год архива: {year}")"""
