from django.contrib.auth.views import LogoutView, PasswordChangeView, PasswordChangeDoneView
from django.urls import path
from users import views
from users.views import PasswordChangeUser

app_name = 'users'

urlpatterns = [
    path('login/', views.LoginUser.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', views.RegisterUser.as_view(), name='register'),
    path('register/done/', views.register_user_done, name='register_done'),
    path('profile/', views.ProfileUser.as_view(), name='profile'),
    path('password-change/', PasswordChangeUser.as_view(), name='password_change'),
    path('password-change/done/', PasswordChangeDoneView.as_view(template_name="users/password_change_done.html"), name='password_change_done'),
]
