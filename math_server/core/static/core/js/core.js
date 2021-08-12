(function(angular, bootstrap){
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
            }).state('wellproductionmodel', {
                url: "/models/wellproductionmodel",
                templateUrl: 'templates/wellproductionmodel.html',
                controller: 'wellproductionmodelController'
            })
            // $locationProvider.html5Mode(true)
        }])

    math_server.factory('excelClipboardParser', function() {
        return function(text) {
            return new Promise(function(resolve, reject) {
                if (!text) reject('Буфер обмена пуст')
                text = text.replace(/\r/g, '').trim('\n')
                let rowsOfText = text.split('\n')
                let header = []
                let rows = []
                rowsOfText.forEach(function (rowAsText) {
                    let row = rowAsText.split('\t').map(function (colAsText) {
                        return colAsText.trim().replace(/^"(.*)"$/, '$1')
                    })
                    if (header.length == 0) {
                        while (row.length && !row[row.length - 1].trim()) row.pop()
                        if (row.length == 0) return
                        header = row
                    }
                    rows.push(row.slice(0, header.length))
                })
                resolve(rows)
            })
        }
    })

    math_server.directive('nizTableEditor', function() {
        return {
            restrict: 'E',
            scope: {
                table: '='
            },
            transclude: true,
            controller: function ($scope, excelClipboardParser) {
                let modalInstance = undefined

                $scope.showModal = function() {
                    $scope.niz_table_temp = angular.copy($scope.table) || []
                    modalInstance = new bootstrap.Modal(document.getElementById(`modal_${ $scope.$id }`), {})
                    modalInstance.show()
                }

                $scope.closeModal = function(){
                    modalInstance.hide()
                }

                $scope.save = function(){
                    $scope.table = $scope.niz_table_temp
                    modalInstance.hide()
                }

                $scope.readFromClipboard = function() {
                    navigator.clipboard.readText().then(text => {
                        excelClipboardParser(text).then(text => {
                            $scope.niz_table_temp = text
                            $scope.$apply()
                        })
                    })
                }
            },
            templateUrl: 'templates/widgets/table_editor/niz_table_editor.html'
        }
    })

    math_server.controller('modelsController', function ($scope, $http, $filter) {
        $scope.grouped_models = {}
        $scope.filtred_models = {}
        $scope.search = ''

        $scope.$watch('search', function (newValue) {
            $scope.filtred_models = {}
            angular.forEach($scope.grouped_models, function (value, key) {
                let a = $filter('filter')(value, $scope.search)

                if(a.length > 0){
                    $scope.filtred_models[key] = a
                }
            })
        })

        $scope.loadModels = function () {
            $http.get('/api/math_model').then(function(response) {
                $scope.grouped_models = response.data
                $scope.filtred_models = $scope.grouped_models
            }, function(rejection) {})
        }

        $scope.isEmptyObject = function(obj) {
            return (obj && (Object.keys(obj).length === 0));
        }

        $scope.loadModels()
    })

    math_server.controller('wellproductionmodelController', function($scope, $http) {
        $http.get('/api/math_model/wellproductionmodel').then(function(response){
            $scope.model_instance = response.data
            if(!$scope.model_instance.input_data){
                $scope.model_instance.input_data = {
                    niz_table: [],
                    kin: 0,
                    total: 0
                }
            }
        })

        let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        let tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        })

    })
})(angular, bootstrap)