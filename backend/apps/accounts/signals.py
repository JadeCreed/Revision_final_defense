# # accounts/signals.py
# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from .models import User, FarmerProfile

# @receiver(post_save, sender=User)
# def create_farmer_profile(sender, instance, created, **kwargs):
#     if created:
#         FarmerProfile.objects.create(
#             user=instance,
#             middle_name="",
#             suffix="",
#             date_of_birth=None,
#             gender="",
#             residency_address={},
#             farm_location={},
#             demographics=[]
#         )