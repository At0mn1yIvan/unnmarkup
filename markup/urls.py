from django.urls import path
from markup import views

app_name = "markup"

urlpatterns = [
    path("list/", views.MarkupListView.as_view(), name="markup_list"),
    path("start/", views.StartNewMarkupView.as_view(), name="start_new_markup"),
    path(
        "perform/<int:markup_id>/",
        views.PerformMarkupView.as_view(),
        name="perform_markup",
    ),
    path(
        "upload/",
        views.SignalUploadView.as_view(),
        name="signal_upload",
    ),
    path(
        "validation/queue/",
        views.ValidationSignalListView.as_view(),
        name="validation_queue_list",
    ),  # pragma: no cover
    path(
        "validation/start_next/",
        views.StartSignalValidationView.as_view(),
        name="start_validation",
    ),  # pragma: no cover
    path(
        "validation/perform/<int:signal_id>/",
        views.PerformSignalValidationView.as_view(),
        name="perform_signal_validation",
    ),  # pragma: no cover
    path(
        "validation/view_markup/<int:markup_id>/",
        views.ViewMarkupDetailReadOnlyView.as_view(),
        name="view_markup_detail_readonly",
    ),  # pragma: no cover
]
