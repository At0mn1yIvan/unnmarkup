from django.contrib.auth.views import LogoutView
from django.urls import path
from users import views

app_name = 'users'

urlpatterns = [
    path('login/', views.LoginUser.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('register/', views.RegisterUser.as_view(), name='register'),
    path('register-done/', views.register_user_done, name='register_done')
]
