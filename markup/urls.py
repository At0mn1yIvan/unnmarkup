from django.urls import path
from markup import views


app_name = "markup"

urlpatterns = [
    path("list/", views.MarkupListView.as_view(), name="markup_list"),
    path(
        "start/", views.StartNewMarkupView.as_view(), name="start_new_markup"
    ),
    path(
        "perform/<int:markup_id>/",
        views.PerformMarkupView.as_view(),
        name="perform_markup",
    ),
    # path("markup/", views.markup, name="markup"),
    # path("save-diagnoses/", views.save_diagnoses, name="save_diagnoses"),
    # path("save-markup/", views.save_markup, name="save_markup"),
    # path(
    #     "submit-validation/", views.submit_validation, name="submit_validation"
    # ),
    path(
        "upload/",
        views.SignalUploadView.as_view(),
        name="signal_upload",
    ),
]
