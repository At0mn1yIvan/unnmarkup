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


# class EnsureMarkerProfileExistsMixin(AccessMixin):
#     """
#     Миксин для проверки наличия marker_profile у request.user.
#     """

#     def dispatch(self, request, *args, **kwargs):
#         try:
#             # Это вызовет ObjectDoesNotExist, если профиль не существует для текущего пользователя.
#             _ = request.user.marker_profile
#         except ObjectDoesNotExist:
#             messages.error(
#                 request,
#                 "Для выполнения этого действия вашему аккаунту необходим связанный профиль маркировщика. Суперпользователям также необходимо создать профиль маркировщика для разметки.",
#             )
#             # Перенаправление на соответствующую страницу, возможно, где можно управлять профилями или на список разметок.
#             return redirect(
#                 "markup_list"
#             )  # Предполагается, что URL с именем 'markup_list' существует
#         except AttributeError:
#             messages.error(request, "Ошибка конфигурации пользователя.")
#             return redirect("markup_list")

#         return super().dispatch(request, *args, **kwargs)


class UserIsSupplierOrSuperuserMixin(AccessMixin):
    """
    Миксин для проверки того, что текущий пользователь аутентифицирован
    и является либо суперпользователем, либо имеет активный supplier_profile.
    """

    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()  # Перенаправляет на LOGIN_URL

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
