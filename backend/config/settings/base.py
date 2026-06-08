"""
Django base settings moved from config/settings.py.
Shared settings for all environments.
"""
import os
from pathlib import Path
from datetime import timedelta
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
# base.py is located at backend/config/settings/base.py so go up three levels to reach project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = config("SECRET_KEY", default="django-insecure-temp")
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = []


# Application definition

AUTH_USER_MODEL = 'accounts.User'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    'apps.accounts',
    'apps.crop_monitoring',
    'apps.crop_phase',
    'apps.distribution',
    'apps.gis_map',
    'apps.production',
    'apps.reports',
    'apps.seed_inventory',
    'apps.seed_poll',
    'apps.announcements',
    'apps.analytics',

    'rest_framework',
    'corsheaders',
]

# Allow React dev server with credentials
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
]

CORS_ALLOW_CREDENTIALS = True

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'Asia/Manila'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'

# ─── CACHING (for rate limiting and session storage) ───
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'agrice-cache',
    }
}


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.accounts.authentication.CookieJWTAuthentication',  # 🍪 Reads from httpOnly cookies
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── HARVEST WEIGHT AND COOKIE DEFAULTS ──
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False  # True in production (HTTPS only)
SESSION_COOKIE_SAMESITE = 'Lax'  # Use 'None'+Secure for cross-site in production

# Allow admin/login JS to access CSRF cookie in dev; keep secure defaults in prod
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SECURE = False  # True in production
CSRF_COOKIE_SAMESITE = 'Lax'

# JWT Token can be accessed via cookies
JWT_AUTH_COOKIE = 'access_token'
JWT_AUTH_COOKIE_SECURE = False  # True in production (HTTPS)
JWT_AUTH_COOKIE_SAMESITE = 'Lax'  # Allow in dev over HTTP; use 'None' with Secure in prod


# =========================
# 📧 EMAIL CONFIG (BREVO)
# =========================

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp-relay.brevo.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True

EMAIL_HOST_USER = config("BREVO_SENDER_EMAIL")
EMAIL_HOST_PASSWORD = config("BREVO_API_KEY")

DEFAULT_FROM_EMAIL = "dumpchlb121@gmail.com"

# =========================
# 🌾 AGRICULTURE CONSTANTS
# =========================
# Seeding density (kg/ha) per seed type - DA standard
SEEDING_DENSITY = {
    'HYBRID':   15,
    'INBRED':   40,
    'OWN_SEED': 50,
}

# Standard yield (kg/ha dry weight) per seed type
STANDARD_YIELDS = {
    'HYBRID': 5000,    # kg/ha
    'INBRED': 4000,    # kg/ha
    'OWN_SEED': 3000,  # kg/ha (pending client confirmation)
}

# =========================
# 📁 MEDIA FILES (Farmer ID Card Uploads)
# =========================
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
