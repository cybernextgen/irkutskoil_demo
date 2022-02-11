from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Individual, Employee, NSIDataImportStatus


def group(user):
    groups = []
    for group in user.groups.all():
        groups.append(group.name)
    return ' '.join(groups)


group.short_description = 'Группы'

UserAdmin.list_display = ('username', 'email', 'first_name', 'last_name',
                          'is_staff', 'last_login', 'date_joined', group)


class IndividualModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'surname', 'patronymic', 'birth_date', 'inn', 'snils', 'code', 'is_deleted']


class EmployeeModelAdmin(admin.ModelAdmin):
    list_display = ['employee_number', 'full_name', 'individual',
                    'employment_date', 'dismissal_date', 'code', 'is_primary_workplace']


class NSIDataImportStatusModelAdmin(admin.ModelAdmin):
    list_display = ['created_timestamp', 'user', 'is_pending']


admin.site.register(Individual, IndividualModelAdmin)
admin.site.register(Employee, EmployeeModelAdmin)
admin.site.register(NSIDataImportStatus, NSIDataImportStatusModelAdmin)
