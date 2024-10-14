from django.urls import path
from markupheart import views

urlpatterns = [
    path("", views.MarkupheartHome.as_view(), name="home"),
    path("about/", views.MarkupheartAbout.as_view(), name="about"),
]
