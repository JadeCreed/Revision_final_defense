from rest_framework import status
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.accounts.models import User
from .models import HarvestRecord
from .serializers import HarvestRecordSerializer


class HarvestRecordListCreateView(ListCreateAPIView):
    """GET /api/production/harvest/ and POST /api/production/harvest/"""
    serializer_class = HarvestRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = HarvestRecord.objects.select_related('farmer', 'encoded_by')
        user = self.request.user
        if user.role == 'BRGY':
            return queryset.filter(barangay=user.barangay)
        return queryset.order_by('-harvest_date', '-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        farmer = serializer.validated_data.get('farmer')
        if not farmer or farmer.role != 'FARMER':
            raise ValidationError({'farmer': 'Please select a registered farmer.'})
        if user.role == 'BRGY' and farmer.barangay != user.barangay:
            raise PermissionDenied('You may only save harvest records for your barangay.')

        serializer.save(
            encoded_by=user,
            barangay=farmer.barangay or user.barangay,
        )


class HarvestRecordDetailView(RetrieveUpdateDestroyAPIView):
    """PATCH /api/production/harvest/<id>/ and DELETE /api/production/harvest/<id>/"""
    queryset = HarvestRecord.objects.select_related('farmer', 'encoded_by')
    serializer_class = HarvestRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role == 'BRGY' and obj.barangay != user.barangay:
            raise PermissionDenied('You may not access this harvest record.')
        return obj

    def perform_update(self, serializer):
        user = self.request.user
        farmer = serializer.validated_data.get('farmer', self.get_object().farmer)
        if user.role == 'BRGY' and farmer.barangay != user.barangay:
            raise PermissionDenied('You may only update harvest records for your barangay.')
        serializer.save(barangay=farmer.barangay or self.get_object().barangay)

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == 'BRGY' and instance.barangay != user.barangay:
            raise PermissionDenied('You may not delete this harvest record.')
        super().perform_destroy(instance)
