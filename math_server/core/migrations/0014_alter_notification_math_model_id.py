# Generated by Django 3.2.6 on 2022-02-11 02:02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_auto_20220210_2251'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='math_model_id',
            field=models.CharField(max_length=50, null=True),
        ),
    ]
