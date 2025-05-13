from django.contrib.auth import get_user_model
from django.core.management import BaseCommand
from users.models import MarkerProfile, SupplierProfile, ValidatorProfile

User = get_user_model()


# class Command(BaseCommand):
#     help = "Создает суперпользователя со всеми профилями"

#     def handle(self, *args, **options):
#         username = input("Введите имя пользователя: ")
#         email = input("Введите email: ")
#         password = input("Введите пароль: ")
#         phone = input("Введите номер телефона: ")

#         user = User.objects.create_superuser(
#             username=username, email=email, password=password, phone=phone
#         )

#         # Создаем все профили
#         MarkerProfile.objects.create(user=user)
#         ValidatorProfile.objects.create(user=user)
#         SupplierProfile.objects.create(user=user)

#         self.stdout.write(
#             self.style.SUCCESS(
#                 f"Создан суперпользователь {username} с полными правами"
#             )
#         )
