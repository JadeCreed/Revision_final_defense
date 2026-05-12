from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crop_monitoring', '0002_barangaycropsummary_cropmonitoringrecord_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='cropmonitoringrecord',
            name='phase_status',
            field=models.CharField(choices=[('NORMAL', 'Normal'), ('DELAYED', 'Delayed'), ('DAMAGED', 'Damaged')], default='NORMAL', max_length=10, help_text='Quick status summary for this crop observation'),
        ),
        migrations.AddField(
            model_name='cropmonitoringrecord',
            name='delay_days',
            field=models.PositiveIntegerField(blank=True, null=True, help_text='Days delayed if status is delayed'),
        ),
        migrations.AddField(
            model_name='cropmonitoringrecord',
            name='damage_cause',
            field=models.CharField(blank=True, help_text='Cause of damage if status is damaged', max_length=100),
        ),
    ]
