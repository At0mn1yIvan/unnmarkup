from django.contrib import messages
from django.contrib.auth.mixins import AccessMixin
from django.core.exceptions import ObjectDoesNotExist
from django.shortcuts import redirect


class UserIsMarkerOrSuperuserMixin(AccessMixin):
    """
    Миксин для проверки того, что текущий пользователь аутентифицирован
    и является либо суперпользователем, либо имеет активный marker_profile.
    """

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()  # Перенаправляет на LOGIN_URL

        can_access = False
        if request.user.is_superuser:
            can_access = True
        else:
            try:
                if request.user.marker_profile:
                    can_access = True
            except (ObjectDoesNotExist, AttributeError):
                pass
        if not can_access:
            messages.error(
                request,
                "У вас нет прав разметчика данных для доступа к этой странице.",
            )
            return redirect(
                "home"
            )

        return super().dispatch(request, *args, **kwargs)


class UserIsSupplierOrSuperuserMixin(AccessMixin):
    """
    Миксин для проверки того, что текущий пользователь аутентифицирован
    и является либо суперпользователем, либо имеет активный supplier_profile.
    """

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()

        can_access = False
        if request.user.is_superuser:
            can_access = True
        else:
            try:
                if request.user.supplier_profile:
                    can_access = True
            except (ObjectDoesNotExist, AttributeError):
                pass
        if not can_access:
            messages.error(
                request,
                "У вас нет прав поставщика данных для доступа к этой странице.",
            )
            return redirect(
                "home"
            )

        return super().dispatch(request, *args, **kwargs)


class UserIsValidatorOrSuperuserMixin(AccessMixin):
    """
    Миксин для проверки того, что текущий пользователь аутентифицирован
    и является либо суперпользователем, либо имеет активный validator_profile.
    """

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()

        can_access = False
        if request.user.is_superuser:
            can_access = True
        else:
            try:
                if request.user.validator_profile:
                    can_access = True
            except (ObjectDoesNotExist, AttributeError):
                pass
        if not can_access:
            messages.error(
                request,
                "У вас нет прав валидатора данных для доступа к этой странице.",
            )
            return redirect(
                "home"
            )

        return super().dispatch(request, *args, **kwargs)
