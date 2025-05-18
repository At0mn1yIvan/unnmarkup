from functools import wraps

from django.http import HttpResponseForbidden


def supplier_or_superuser_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not (
            request.user.is_superuser
            or hasattr(request.user, "supplier_profile")
        ):
            return HttpResponseForbidden(
                "Доступ только для поставщиков данных"
            )
        return view_func(request, *args, **kwargs)

    return _wrapped_view
