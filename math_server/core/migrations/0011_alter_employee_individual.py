# Generated by Django 3.2.6 on 2022-02-10 14:49

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_rename_surmane_individual_surname'),
    ]

    operations = [
        migrations.AlterField(
            model_name='employee',
            name='individual',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='core.individual', verbose_name='Физическое лицо'),
        ),
    ]
