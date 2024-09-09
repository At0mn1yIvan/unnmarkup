from django.urls import path, register_converter
from markupheart import views
from markupheart import converters

# register_converter(converters.FourDigitYearConverter, 'year4')
# path('archive/<year4:year>', views.archive)
urlpatterns = [
    path('', views.MarkupheartHome.as_view(), name='home'),
    path('about/', views.MarkupheartAbout.as_view(), name='about'),
    path('markup/', views.markup, name='markup'),
    path('login/', views.MarkupheartLogin.as_view(), name='login'),
]
