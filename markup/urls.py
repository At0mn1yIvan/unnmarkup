from django.urls import path
from markup import views

app_name = "markup"

urlpatterns = [
    path("markup/", views.markup, name="markup"),
    path("save-diagnoses/", views.save_diagnoses, name="save_diagnoses"),
    path("save-markup/", views.save_markup, name="save_markup"),
    path(
        "submit-validation/", views.submit_validation, name="submit_validation"
    ),
]
