# coding: utf-8
from django.urls import path, re_path
from .views import MathModelAPIView
from .views import LoginRequiredTemplateView
from django.contrib.auth import views as auth_views
from django.conf import settings


urlpatterns = [
    path('api/math_model', MathModelAPIView.as_view()),
    path('api/math_model/<str:model_id>', MathModelAPIView.as_view()),
    path('templates/index.html', LoginRequiredTemplateView.as_view(template_name='core/index.html')),
    path('templates/models_list.html', LoginRequiredTemplateView.as_view(template_name='core/models_list.html')),
    path('templates/wellproductionmodel.html',
         LoginRequiredTemplateView.as_view(template_name='core/wellproductionmodel.html')),
    path('templates/widgets/table_editor/niz_table_editor.html',
         LoginRequiredTemplateView.as_view(template_name='widgets/table_editor/niz_table_editor.html')),
    path(settings.LOGIN_URL, auth_views.LoginView.as_view(template_name='auth/login.html'), name='login'),
    path(settings.LOGOUT_URL, auth_views.LogoutView.as_view(), name='logout'),
    re_path(r'^$', LoginRequiredTemplateView.as_view(template_name='core/index.html')),
]
