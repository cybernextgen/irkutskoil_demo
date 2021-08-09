# coding: utf-8
from django.urls import path, re_path
from django.views.generic import TemplateView
from .views import MathModelAPIView


urlpatterns = [
    path('api/math_model', MathModelAPIView.as_view()),
    path('api/math_model/<str:model_id>', MathModelAPIView.as_view()),
    path('templates/index.html', TemplateView.as_view(template_name='core/index.html')),
    path('templates/models_list.html', TemplateView.as_view(template_name='core/models_list.html')),
    re_path(r'^$', TemplateView.as_view(template_name='core/base.html')),
]
