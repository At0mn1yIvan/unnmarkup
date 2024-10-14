from django.urls import path
from markup import views

app_name = "markup"

urlpatterns = [
    path("markup/", views.markup, name="markup"),
]
