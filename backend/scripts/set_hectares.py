import os
import argparse
from decimal import Decimal
from django.db import models

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
import django
django.setup()
from apps.accounts.models import FarmerProfile


def main():
    parser = argparse.ArgumentParser(description='Set hectares for approved farmer profiles (safe by default).')
    parser.add_argument('--value', type=str, default='1', help='Hectares value to set (default: 1)')
    parser.add_argument('--apply', action='store_true', help='Apply the update. Without this the script only does a dry-run.')
    parser.add_argument('--include-zero', action='store_true', help='Also treat 0 as missing and update those records.')
    args = parser.parse_args()

    try:
        hectares_value = Decimal(args.value)
    except Exception:
        print('Invalid hectares value; must be numeric. Example: --value 1 or --value 0.5')
        return

    # Only target farmer profiles whose user has been approved by admin
    q = FarmerProfile.objects.filter(user__status='APPROVED')
    # Only update profiles that do not have hectares set (or optionally are zero)
    if args.include_zero:
        q = q.filter(models.Q(hectares__isnull=True) | models.Q(hectares=0))
    else:
        q = q.filter(hectares__isnull=True)

    count = q.count()
    print(f'Found {count} approved profiles eligible for update (dry-run by default).')

    # print first 10 as verification
    for p in q[:10]:
        print(p.user.first_name, p.user.last_name, '->', p.hectares, 'status=', p.user.status)

    if count == 0:
        print('No profiles to update.')
        return

    if args.apply:
        updated = q.update(hectares=hectares_value)
        print(f'Updated {updated} profiles to {hectares_value} ha')
    else:
        print('Dry-run complete. Re-run with --apply to make changes.')


if __name__ == '__main__':
    main()
