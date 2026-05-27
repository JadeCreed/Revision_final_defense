import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings.dev')
import django
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
print(list(User.objects.filter(is_superuser=True).values('id','contact_number','email','is_active','is_staff')))
