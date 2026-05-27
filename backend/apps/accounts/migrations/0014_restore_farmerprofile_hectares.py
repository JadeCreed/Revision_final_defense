from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0013_remove_farmerprofile_hectares'),
    ]

    operations = [
        migrations.AddField(
            model_name='farmerprofile',
            name='hectares',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True, help_text='Total farm hectares'),
        ),
    ]
