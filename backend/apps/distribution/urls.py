from django.urls import path, include

urlpatterns = [
    path('', include('apps.distribution.urls_beneficiaries')),
    path('', include('apps.distribution.urls_distribution')),
]