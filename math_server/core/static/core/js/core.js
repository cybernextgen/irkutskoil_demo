(function(angular, bootstrap){
    class ValidationError extends Error {
        constructor(message) {
            super(message)
            this.name = "ValidationError"
        }
    }

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

    math_server.factory('ruLocaleDateParser', function() {
        return text => {
            if(!text) throw new ValidationError("Дата не указана")
            let splitedDateString = text.split(".")
            let date = new Date(splitedDateString[2] + "-" + splitedDateString[1] + "-" + splitedDateString[0])
            if(isNaN(date)) throw new ValidationError(`Неверный формат даты: ${text}`)
            return date
        }
    })

    math_server.factory('numberParser', function() {
        return text => {
            if(!text) throw new ValidationError("Значение не указано")
            let parsedNumber = Number(text)
            if(isNaN(parsedNumber)) throw new ValidationError(`Неверный формат числа: ${text}`)
            return parsedNumber
        }
    })

    math_server.factory('isEmptyObjectChecker', function() {
        return obj => {
            for(var key in obj) {
                if(obj.hasOwnProperty(key))
                    return false;
            }
            return true;
        }
    })

    math_server.directive('nizTableEditor', function() {
        return {
            restrict: 'E',
            scope: {
                table: '='
            },
            transclude: true,
            controller: function ($scope, excelClipboardParser, ruLocaleDateParser, numberParser) {
                let modalInstance = undefined

                $scope.showModal = function(){
                    $scope.niz_table_temp = angular.copy($scope.table) || []
                    $scope.validationError = undefined
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
                    $scope.validationError = undefined
                    navigator.clipboard.readText().then(text => {
                        excelClipboardParser(text).then(text => {
                            try{
                                for(let i = 0; i < text.length; i++){
                                    let src_row = text[i]
                                    let parsed_row = []
                                    parsed_row[0] = ruLocaleDateParser(src_row[0])
                                    parsed_row[1] = numberParser(src_row[1])
                                    parsed_row[2] = numberParser(src_row[2])
                                    $scope.niz_table_temp.push(parsed_row)
                                }
                                $scope.$apply()
                            }catch(e){
                                if (e instanceof ValidationError) {
                                    $scope.niz_table_temp = []
                                    $scope.validationError = `Ошибка валидации! ${e.message}`
                                    $scope.$apply()
                                }else throw e
                            }
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
            controller: function ($scope, excelClipboardParser, numberParser) {
                let modalInstance = undefined
                let deleteDialog = undefined

                $scope.selectedModelNum = undefined
                $scope.selectedModel = {name: '', table: []}

                $scope.editModel = function(model_num){
                    $scope.validationError = undefined
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
                    $scope.validationError = undefined
                    navigator.clipboard.readText().then(text => {
                        excelClipboardParser(text).then(text => {
                            $scope.selectedModel.table = []
                            try{
                                for(let i = 0; i < text.length; i++){
                                    $scope.selectedModel.table.push(numberParser(text[i]))
                                }
                            }catch(e){
                                if (e instanceof ValidationError) {
                                    $scope.selectedModel.table = []
                                    $scope.validationError = `Ошибка валидации! ${e.message}`
                                }else throw e
                            }

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

    math_server.directive('chartViewer', function() {
        return {
            restrict: 'E',
            scope: {
                series: '='
            },
            transclude: true,
            controller: function ($scope) {
                let canvas_el = document.getElementById('chartContainer')
                $scope.chart = new Chart(canvas_el.getContext('2d'), {
                    type: 'line',
                    data: {},
                    options: {
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        },
                        aspectRatio: 1.618
                    }
                })

                $scope.$watch('series', function(newValue){
                    if(newValue){
                        const colors = ['red', 'green', 'blue', 'gray']
                        let data = {labels: $scope.series.labels, datasets: []}
                        angular.forEach($scope.series.datasets, function(row, index) {
                            let existingDataset = $scope.chart.data.datasets[index]
                            let isHidden = false
                            if(existingDataset != undefined){
                                isHidden = existingDataset.hidden
                            }
                            data.datasets.push(angular.extend(row, {
                                borderWidth: 2,
                                pointRadius: 1,
                                borderColor: colors[index],
                                backgroundColor: colors[index],
                                hidden: isHidden
                            }))
                        })
                        $scope.chart.data = data
                        $scope.chart.update()
                    }
                }, true)

                $scope.changeDatatsetVisibility = function(dataset_index) {
                    let dataset = $scope.chart.data.datasets[dataset_index]
                    dataset.hidden = !dataset.hidden
                    $scope.chart.update()
                }
            },
            templateUrl: 'templates/widgets/chart_viewer.html'
        }
    })


    math_server.controller('modelsController', function ($scope, $http, $filter) {
        $scope.grouped_models = {}
        $scope.filtred_models = {}
        $scope.search = ''

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

    math_server.controller('wellproductionmodelController', function($scope, $http, numberParser, isEmptyObjectChecker) {
        $http.get('/api/math_model/wellproductionmodel').then(response => {
            $scope.modelInstance = response.data
            if(!$scope.modelInstance.input_data){
                $scope.modelInstance.input_data = {
                    niz_table: [],
                    kin: 0,
                    total: 0,
                    debit: 0,
                    referent_models: []
                }
            }
        })

        $scope.isProcessing = false
        $scope.chartSeries = {}
        $scope.validationErrors = {}
        let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        let tooltipList = tooltipTriggerList.map(tooltipTriggerEl => {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        })

        $scope.updateChartSeries = function() {
            let res = {labels: [], datasets: []}

            let production_series = {label: 'Прогноз', data: []}
            angular.forEach($scope.modelInstance.output_data.production_table, row =>{
                production_series.data.push(row[2])
                res.labels.push(row[0])
            })
            res.datasets.push(production_series)
            angular.forEach($scope.modelInstance.input_data.referent_models, function(model) {
                res.datasets.push({
                    label: model.name,
                    data: model.table
                })
            })
            $scope.chartSeries = res
        }

        $scope.$watch('modelInstance.output_data', function(newValue) {
            if(newValue){
                $scope.updateChartSeries()
            }
        }, true)

        $scope.$watch('modelInstance.input_data.referent_models', function(newValue) {
            if(newValue){
                $scope.updateChartSeries()
            }
        }, true)

        $scope.validateInput = function() {
            $scope.validationErrors = {}
            if(!modelInstance.input_data.niz_table.length){
                $scope.validationErrors['niz_table'] = 'Не заполнена таблица "Отбор от НИЗ / Обводнённость"'
            }

            const number_fields = ['kin', 'total', 'debit']
            for(let i = 0; i < number_fields.length; i++){
                const field =  number_fields[i]
                try{
                    numberParser(modelInstance.input_data[field])
                }catch(e){
                    if (e instanceof ValidationError) {
                        $scope.validationErrors[field] = `Ошибка валидации! ${e.message}`
                    }else throw e
                }
            }
        }

        $scope.calculate = function(){
            if(isEmptyObjectChecker(validationErrors)){
                $scope.isProcessing = true
                $http.put('/api/math_model/wellproductionmodel', $scope.modelInstance.input_data, {headers: {'Content-Type': 'application/json', 'charset': 'utf-8'}}).then(
                    response => {
                        $scope.modelInstance.output_data = response.data
                    }, rejection => {

                    }).finally(()=>{
                    $scope.isProcessing = false
                })
            }
        }
    })
})(angular, bootstrap)