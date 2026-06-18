from datetime import timedelta
import time

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .models import User


class LoginTokenExpiryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            first_name='Jane',
            last_name='Doe',
            contact_number='09123456789',
            email='jane@example.com',
            password='Password123!',
            role='FARMER',
            is_verified=True,
        )

    def test_remember_me_sets_longer_access_token_expiry(self):
        response = self.client.post(
            reverse('login'),
            {
                'login': '09123456789',
                'password': 'Password123!',
                'remember_me': True,
            },
            format='json'
        )

        self.assertEqual(response.status_code, 200)

        token = AccessToken(response.data['access_token'])
        expires_at = token['exp']

        self.assertGreaterEqual(
            expires_at - int(time.time()),
            int((timedelta(days=29)).total_seconds())
        )
