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
        return text => {
            return new Promise((resolve, reject) => {
                if (!text) reject('Буфер обмена пуст')
                text = text.replace(/\r/g, '').trim('\n')
                let rowsOfText = text.split('\n')
                let header = []
                let rows = []
                rowsOfText.forEach(rowAsText => {
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

                $scope.showModal = function(){
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

                $scope.readFromClipboard = function(){
                    navigator.clipboard.readText().then(text => {
                        excelClipboardParser(text).then(text => {
                            $scope.niz_table_temp = text
                            $scope.$apply()
                        })
                    })
                }

                $scope.clear = function(){
                    $scope.niz_table_temp = []
                }
            },
            templateUrl: 'templates/widgets/table_editor/niz_table_editor.html'
        }
    })

    math_server.directive('referentModelTableEditor', function() {
        return {
            restrict: 'E',
            scope: {
                referentModels: '='
            },
            transclude: true,
            controller: function ($scope, excelClipboardParser) {
                let modalInstance = undefined
                let deleteDialog = undefined

                $scope.selectedModelNum = undefined
                $scope.selectedModel = {name: '', table: []}

                $scope.editModel = function(model_num){
                    if(model_num >= 0 && model_num < $scope.referentModels.length){
                        $scope.selectedModelNum = model_num
                        $scope.selectedModel = angular.copy($scope.referentModels[model_num])
                    }else{
                        $scope.selectedModelNum = undefined
                        $scope.selectedModel = {name: '', table: []}
                    }
                    modalInstance = new bootstrap.Modal(document.getElementById(`modal_${ $scope.$id }`), {})
                    modalInstance.show()
                }

                $scope.closeModal = function(){
                    modalInstance.hide()
                }

                $scope.save = function(){
                    if($scope.selectedModelNum === undefined){
                        if(!$scope.referentModels) $scope.referentModels = []
                        $scope.referentModels.push($scope.selectedModel)
                    }else{
                        $scope.referentModels[$scope.selectedModelNum] = $scope.selectedModel
                    }
                    modalInstance.hide()
                }

                $scope.readFromClipboard = function(){
                    navigator.clipboard.readText().then(text => {
                        excelClipboardParser(text).then(text => {
                            $scope.selectedModel.table = text
                            $scope.$apply()
                        })
                    })
                }

                $scope.showDeleteDialog = function(model_num) {
                    if(model_num >= 0 && model_num < $scope.referentModels.length){
                        $scope.selectedModelNum = model_num
                        $scope.selectedModel = $scope.referentModels[model_num]
                    }else{
                        return
                    }

                    deleteDialog = new bootstrap.Modal(document.getElementById(`delete_dialog_${ $scope.$id }`), {})
                    deleteDialog.show()
                }

                $scope.deleteModel = function(){
                    $scope.referentModels.splice($scope.selectedModelNum, 1)
                    deleteDialog.hide()
                }

                $scope.clear = function(){
                    $scope.selectedModel.table = []
                }
            },
            templateUrl: 'templates/widgets/table_editor/referent_table_editor.html'
        }
    })

    math_server.directive('confirmationDialog', function() {
        return {
            restrict: 'E',
            scope: {
                callback: '='
            },
            transclude: true,
            controller: function ($scope) {
                let modalInstance = undefined
                $scope.showModal = function(){
                    modalInstance = new bootstrap.Modal(document.getElementById(`modal_${ $scope.$id }`), {})
                    modalInstance.show()
                }

                $scope.closeModal = function(){
                    modalInstance.hide()
                }
            },

        }
    })

    math_server.controller('modelsController', function ($scope, $http, $filter) {
        $scope.grouped_models = {}
        $scope.filtred_models = {}
        $scope.search = ''
        $scope.isProcessing = false

        $scope.$watch('search',  newValue => {
            $scope.filtred_models = {}
            angular.forEach($scope.grouped_models, (value, key) => {
                let a = $filter('filter')(value, $scope.search)

                if(a.length > 0){
                    $scope.filtred_models[key] = a
                }
            })
        })

        $scope.loadModels = function () {
            $http.get('/api/math_model').then(response => {
                $scope.grouped_models = response.data
                $scope.filtred_models = $scope.grouped_models
            }, rejection => {})
        }

        $scope.isEmptyObject = function(obj) {
            return (obj && (Object.keys(obj).length === 0));
        }

        $scope.loadModels()
    })

    math_server.controller('wellproductionmodelController', function($scope, $http) {
        $http.get('/api/math_model/wellproductionmodel').then(response => {
            $scope.modelInstance = response.data
            if(!$scope.modelInstance.input_data){
                $scope.modelInstance.input_data = {
                    niz_table: [],
                    kin: 0,
                    total: 0,
                    referent_models: []
                }
            }
        })

        let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        let tooltipList = tooltipTriggerList.map(tooltipTriggerEl => {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        })

        $scope.calculate = function(){
            $scope.isProcessing = true

            $http.put('/api/math_model/wellproductionmodel', $scope.modelInstance.input_data, {headers: {'Content-Type': 'application/json', 'charset': 'utf-8'}}).then(
                data => {
                    console.log(data)
                }, rejection => {
                    console.log(rejection)
                }).finally(()=>{
                $scope.isProcessing = false
            })
        }

    })
})(angular, bootstrap)