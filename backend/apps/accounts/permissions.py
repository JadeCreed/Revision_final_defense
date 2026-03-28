from rest_framework.permissions import BasePermission


class IsAdminUserRole(BasePermission):
    """
    Allows access ONLY to users with ADMIN role
    """

    def has_permission(self, request, view):
        # Check if user is authenticated AND role is ADMIN
        return request.user.is_authenticated and request.user.role == 'ADMIN'


class IsFarmer(BasePermission):
    """
    Allows access ONLY to FARMER users
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'FARMER'


class IsVerifiedUser(BasePermission):
    """
    Allows access ONLY if user is verified by admin
    """

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_verified
    
class IsATUser(BasePermission):
    """
    Only Agricultural Technician users
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'AT'

class IsBPUser(BasePermission):
    """
    Only Barangay President users
    """
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'BRGY'