# Generated by Django 3.2.6 on 2022-02-10 14:50

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_alter_employee_individual'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='employee_number',
            field=models.CharField(blank=True, max_length=100, null=True, verbose_name='Табельный номер'),
        ),
    ]
