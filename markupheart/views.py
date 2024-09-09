from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import HttpResponse, HttpResponseNotFound, Http404
from django.shortcuts import render
from django.views.generic import ListView, TemplateView
import plotly.graph_objs as go
import plotly.subplots as sp
import numpy as np
from markupheart.utils import DataMixin

# Create your views here.


def markup(request):
    data = np.load('media/vanya.npy')
    # names = ['I', 'II', 'III', 'AVR', 'AVL', 'AVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6']
    names = ['I', 'V1', 'II', 'V2', 'III', 'V3', 'AVR', 'V4', 'AVL', 'V5', 'AVF', 'V6']

    fig = sp.make_subplots(rows=6, cols=2, subplot_titles=names)

    for i in range(len(data)):
        row = (i % 6) + 1
        col = (i // 6) + 1
        fig.add_trace(go.Scatter(y=data[i], mode='lines'), row=row, col=col)

    fig.update_layout(height=1000, width=800, title_text='Электрокардиограмма')

    plot_div = fig.to_html(full_html=False)

    return render(request, 'markupheart/markup.html', context={'plot_div': plot_div})

    # x_data = [0, 1, 2, 3]
    # y_data = [x**2 for x in x_data]
    # plot_div = plot([Scatter(x=x_data, y=y_data,
    #                          mode='lines', name='test',
    #                          opacity=0.8)],
    #                 output_type='div',
    #                 include_plotlyjs=False)
    # return render(request, template_name='markupheart/markup.html', context={'plot_div': plot_div})


class MarkupheartHome(DataMixin, TemplateView):
    template_name = 'markupheart/index.html'
    title_page = 'Главная страница сайта'

    '''def get_context_data(self, **kwargs):
        context = super().get_context_data()
        return self.get_mixin_context(context, title)'''


class MarkupheartAbout(LoginRequiredMixin,DataMixin, TemplateView):
    template_name = 'markupheart/about.html'
    title_page = 'О сайте'


class MarkupheartMarkup(LoginRequiredMixin, DataMixin, TemplateView):
    template_name = 'markupheart/markup.html'
    title_page = 'Разметка кардиограммы'


class MarkupheartLogin(DataMixin, TemplateView):
    template_name = 'markupheart/login.html'
    title_page = 'Войти'


def page_not_found(request, exception):
    return HttpResponseNotFound("<h1>Страница не найдена</h1>")


'''
def index(request):
    # return HttpResponse("Страница приложения Markup.")
    data = {'title': 'Главная страница сайта',
            'menu': menu,
            }
    return render(request, template_name='markupheart/index.html', context=data)'''

'''def about(request):
    data = {'title': 'О сайте',
            'menu': menu,
            }
    return render(request, template_name='markupheart/about.html', context=data)'''

'''def markup(request):
    data = {'title': 'Разметка кардиограммы',
            'menu': menu,
            }
    return render(request, template_name='markupheart/markup.html', context=data)
'''

'''def login(request):
    data = {'title': 'Войти',
            'menu': menu,
            }
    return render(request, template_name='markupheart/login.html', context=data)'''

'''def archive(request, year):
    if year > 2024:
        raise Http404()
    return HttpResponse(f"Год архива: {year}")'''
