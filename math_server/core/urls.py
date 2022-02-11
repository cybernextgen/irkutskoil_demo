# coding: utf-8
from django.urls import path, re_path
from .views import MathModelAPIView, NSIAPIView, NSIDataImportAPIView
from .views import PermissionsAPIView
from .views import NotificationAPIView
from .views import LoginRequiredTemplateView
from django.contrib.auth import views as auth_views
from django.conf import settings


urlpatterns = [
    path('api/math_model', MathModelAPIView.as_view()),
    path('api/math_model/<str:model_id>', MathModelAPIView.as_view()),

    path('api/notification', NotificationAPIView.as_view()),
    path('api/notification/new', NotificationAPIView.as_view(is_only_new=True)),
    path('api/notification/new/<int:limit>', NotificationAPIView.as_view(is_only_new=True)),
    path('api/notification/<int:id>', NotificationAPIView.as_view()),

    path('api/permissions', PermissionsAPIView.as_view()),
    path('api/nsi_data_import', NSIDataImportAPIView.as_view()),
    path('api/nsi_data/<int:limit>', NSIAPIView.as_view()),


    path('templates/index.html', LoginRequiredTemplateView.as_view(template_name='core/index.html')),
    path('templates/models_list.html', LoginRequiredTemplateView.as_view(template_name='core/models_list.html')),
    path('templates/wellproductionmodel.html',
         LoginRequiredTemplateView.as_view(template_name='core/wellproductionmodel.html')),
    path('templates/simplecalculatormodel.html',
         LoginRequiredTemplateView.as_view(template_name='core/simplecalculatormodel.html')),

    path('templates/asynccalculatormodel.html',
         LoginRequiredTemplateView.as_view(template_name='core/asynccalculatormodel.html')),

    path('templates/vnswellmodel.html',
         LoginRequiredTemplateView.as_view(template_name='core/vnswellmodel.html')),

    path('templates/nsi.html',
         LoginRequiredTemplateView.as_view(template_name='core/nsi.html')),

    path('templates/widgets/table_editor/niz_table_editor.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/table_editor/niz_table_editor.html')),
    path('templates/widgets/table_editor/referent_table_editor.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/table_editor/referent_table_editor.html')),
    path('templates/widgets/chart_viewer.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/chart_viewer.html')),
    path('templates/widgets/notification_viewer.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/notification_viewer.html')),
    path('templates/widgets/employee_viewer.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/employee_viewer.html')),

    path(settings.LOGIN_URL, auth_views.LoginView.as_view(template_name='auth/login.html'), name='login'),
    path(settings.LOGOUT_URL, auth_views.LogoutView.as_view(), name='logout'),
    re_path(r'^$', LoginRequiredTemplateView.as_view(template_name='core/index.html')),
]
