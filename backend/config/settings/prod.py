from .base import *
from decouple import config

# Production overrides — read secrets from environment variables.
DEBUG = False

# SECRET_KEY should be set in the environment for production. Default is a
# placeholder to avoid crashes in development when accidentally using prod.
SECRET_KEY = config('SECRET_KEY', default='django-insecure-prod-placeholder')

# Comma-separated hosts: example.com,api.example.com
ALLOWED_HOSTS = [h for h in config('ALLOWED_HOSTS', default='').split(',') if h]

# Security recommendations
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
JWT_AUTH_COOKIE_SECURE = True

# PostgreSQL configuration via environment variables
DATABASES = {
	'default': {
		'ENGINE': 'django.db.backends.postgresql',
		'NAME': config('POSTGRES_DB', default='capstone_prod'),
		'USER': config('POSTGRES_USER', default='postgres'),
		'PASSWORD': config('POSTGRES_PASSWORD', default='postgres'),
		'HOST': config('POSTGRES_HOST', default='localhost'),
		'PORT': config('POSTGRES_PORT', default='5432'),
	}
}

# Where `collectstatic` will gather static files for production
STATIC_ROOT = BASE_DIR / 'staticfiles'

# NOTE: Do NOT commit real secrets. Prefer setting these variables in your
# deployment environment or a secure secrets manager.
