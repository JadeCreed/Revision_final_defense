# apps/accounts/authentication.py
# Custom JWT authentication that reads tokens from httpOnly cookies

from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that reads tokens from httpOnly cookies.
    Falls back to Authorization header if cookie not present.

    This ensures secure token storage while maintaining compatibility
    with header-based authentication.
    """

    def authenticate(self, request):
        # 🍪 First, try to authenticate from the httpOnly cookie
        cookie_token = request.COOKIES.get('access_token')
        if cookie_token:
            validated_token = self.get_validated_token(cookie_token)
            return self.get_user(validated_token), validated_token

        # 🔄 Fallback to Authorization header (standard Simple JWT behavior)
        return super().authenticate(request)
