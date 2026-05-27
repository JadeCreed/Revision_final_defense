from .base import *

# Development overrides
DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Local dev static/media defaults (adjust if you use a frontend dev server)
STATIC_URL = '/static/'
