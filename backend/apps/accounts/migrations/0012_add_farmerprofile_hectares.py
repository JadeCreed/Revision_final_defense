# Generated migration to add hectares field to FarmerProfile

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0011_remove_farmerprofile_contact_number_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='farmerprofile',
            name='hectares',
            field=models.DecimalField(blank=True, decimal_places=2, help_text='Total farm hectares', max_digits=5, null=True),
        ),
    ]
