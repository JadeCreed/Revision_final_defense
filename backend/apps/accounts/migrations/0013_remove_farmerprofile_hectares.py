from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_add_farmerprofile_hectares'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='farmerprofile',
            name='hectares',
        ),
    ]
