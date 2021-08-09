(function(angular){
    let math_server = angular.module('math_server', ['ui.router',])

    math_server.config([
        '$httpProvider',
        '$urlRouterProvider',
        '$stateProvider',
        '$locationProvider',
        function($httpProvider, $urlRouterProvider, $stateProvider, $locationProvider) {
            $httpProvider.defaults.xsrfCookieName = 'csrftoken'
            $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken'
            $httpProvider.defaults.headers.common["X-CSRFToken"] = window.csrf_token
            $httpProvider.defaults.useXDomain = true
            delete $httpProvider.defaults.headers.common['X-Requested-With']

            $urlRouterProvider.otherwise("models")
            $stateProvider.state('models', {
                url: "/models",
                templateUrl: "templates/models_list.html",
                controller: 'modelsController'
            })
            // $locationProvider.html5Mode(true)
    }])

    math_server.controller('modelsController', function ($scope, $http) {
        $scope.grouped_models = []
        
        $scope.loadModels = function () {
            $http.get('/api/math_model').then(function(response) {
                $scope.grouped_models = response.data
            }, function(rejection) {})
        }

        $scope.loadModels()
    })
})(angular)