# This fixes:
#   - "Failed to load varieties" (SeedType table was empty)
#   - Empty seed type dropdown in admin
#   - Failed to create poll (no seed types in DB)
# ============================================================

from django.core.management.base import BaseCommand
from apps.seed_poll.models import SeedType, SeedVariety


class Command(BaseCommand):
    help = 'Seeds initial SeedType and SeedVariety data'

    def handle(self, *args, **kwargs):
        seed_data = [
            {
                'name':      'HYBRID',
                'varieties': ['Bigante Plus', 'Long Pin', 'TH 82'],
            },
            {
                'name':      'INBRED',
                'varieties': ['RC 216', 'RC 218', 'RC 480'],
            },
        ]

        for type_data in seed_data:
            # get_or_create prevents duplicates if run multiple times
            seed_type, created = SeedType.objects.get_or_create(
                name=type_data['name']
            )
            status = 'Created' if created else 'Already exists'
            self.stdout.write(f'{status}: SeedType "{seed_type.name}"')

            for variety_name in type_data['varieties']:
                variety, v_created = SeedVariety.objects.get_or_create(
                    seed_type=seed_type,
                    name=variety_name,
                )
                v_status = 'Created' if v_created else 'Already exists'
                self.stdout.write(f'  {v_status}: Variety "{variety_name}"')

        self.stdout.write(
            self.style.SUCCESS(
                '\nDone! SeedType and SeedVariety data is ready. '
                'Refresh the admin Seed Poll page.'
            )
        )