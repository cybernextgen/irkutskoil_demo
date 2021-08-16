/* global bootstrap, angular, Chart */
(function (angular, bootstrap) {
  class ValidationError extends Error {}

  const mathServer = angular.module('mathServer', ['ui.router'])

  mathServer.config([
    '$httpProvider',
    '$urlRouterProvider',
    '$stateProvider',
    '$locationProvider',
    function ($httpProvider, $urlRouterProvider, $stateProvider) {
      $httpProvider.defaults.xsrfCookieName = 'csrftoken'
      $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken'
      $httpProvider.defaults.headers.common['X-CSRFToken'] = window.csrf_token
      $httpProvider.defaults.useXDomain = true
      delete $httpProvider.defaults.headers.common['X-Requested-With']

      $urlRouterProvider.otherwise('models')
      $stateProvider.state('models', {
        url: '/models',
        templateUrl: 'templates/models_list.html',
        controller: 'modelsController'
      }).state('wellproductionmodel', {
        url: '/models/wellproductionmodel',
        templateUrl: 'templates/wellproductionmodel.html',
        controller: 'wellproductionmodelController'
      })
    }])

  mathServer.factory('excelClipboardParser', function () {
    return text => {
      return new Promise((resolve, reject) => {
        if (!text) reject(new Error('Буфер обмена пуст'))
        text = text.replace(/\r/g, '').trim('\n')
        const rowsOfText = text.split('\n')
        let header = []
        const rows = []
        rowsOfText.forEach(rowAsText => {
          const row = rowAsText.split('\t').map((colAsText) => {
            return colAsText.trim().replace(/^"(.*)"$/, '$1')
          })
          if (header.length === 0) {
            while (row.length && !row[row.length - 1].trim()) row.pop()
            if (row.length === 0) return
            header = row
          }
          rows.push(row.slice(0, header.length))
        })
        resolve(rows)
      })
    }
  })

  mathServer.factory('ruLocaleDateParser', function () {
    return text => {
      if (!text) throw new ValidationError('Дата не указана')
      const splittedDateString = text.split('.')
      const date = new Date(`${splittedDateString[2]}-${splittedDateString[1]}-${splittedDateString[0]}`)
      if (isNaN(date)) throw new ValidationError(`Неверный формат даты: ${text}`)
      return date
    }
  })

  mathServer.factory('numberParser', function () {
    return text => {
      if (!text) throw new ValidationError('Значение не указано')
      const parsedNumber = Number(text)
      if (isNaN(parsedNumber)) throw new ValidationError(`Неверный формат числа: ${text}`)
      return parsedNumber
    }
  })

  mathServer.factory('isEmptyObjectChecker', function () {
    return obj => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) { return false }
      }
      return true
    }
  })

  mathServer.directive('nizTableEditor', function () {
    return {
      restrict: 'E',
      scope: {
        table: '=',
        isInvalid: '='
      },
      transclude: true,
      controller: ($scope, excelClipboardParser, ruLocaleDateParser, numberParser) => {
        let modalInstance

        $scope.showModal = () => {
          $scope.niz_table_temp = angular.copy($scope.table) || []
          $scope.validationError = undefined
          modalInstance = new bootstrap.Modal(document.getElementById(`modal_${$scope.$id}`), {})
          modalInstance.show()
        }

        $scope.closeModal = () => {
          modalInstance.hide()
        }

        $scope.save = () => {
          $scope.table = $scope.niz_table_temp
          modalInstance.hide()
        }

        $scope.readFromClipboard = () => {
          $scope.validationError = undefined
          navigator.clipboard.readText().then(text => {
            excelClipboardParser(text).then(text => {
              try {
                text.forEach((srcRow) => {
                  const parsedRow = []
                  parsedRow[0] = ruLocaleDateParser(srcRow[0])
                  parsedRow[1] = numberParser(srcRow[1])
                  parsedRow[2] = numberParser(srcRow[2])
                  $scope.niz_table_temp.push(parsedRow)
                })
                $scope.$apply()
              } catch (e) {
                $scope.niz_table_temp = []
                $scope.validationError = `Ошибка валидации! ${e.message}`
                $scope.$apply()
              }
            })
          })
        }

        $scope.clear = () => {
          $scope.niz_table_temp = []
        }
      },
      templateUrl: 'templates/widgets/table_editor/niz_table_editor.html'
    }
  })

  mathServer.directive('referentModelTableEditor', function () {
    return {
      restrict: 'E',
      scope: {
        referentModels: '='
      },
      transclude: true,
      controller: function ($scope, excelClipboardParser, numberParser) {
        let modalInstance
        let deleteDialog

        $scope.selectedModelNum = undefined
        $scope.selectedModel = { name: '', table: [] }

        $scope.editModel = (modelNum) => {
          $scope.validationError = undefined
          if (modelNum >= 0 && modelNum < $scope.referentModels.length) {
            $scope.selectedModelNum = modelNum
            $scope.selectedModel = angular.copy($scope.referentModels[modelNum])
          } else {
            $scope.selectedModelNum = undefined
            $scope.selectedModel = { name: '', table: [] }
          }
          modalInstance = new bootstrap.Modal(document.getElementById(`modal_${$scope.$id}`), {})
          modalInstance.show()
        }

        $scope.closeModal = () => {
          modalInstance.hide()
        }

        $scope.save = () => {
          if ($scope.selectedModelNum === undefined) {
            if (!$scope.referentModels) $scope.referentModels = []
            $scope.referentModels.push($scope.selectedModel)
          } else {
            $scope.referentModels[$scope.selectedModelNum] = $scope.selectedModel
          }
          modalInstance.hide()
        }

        $scope.readFromClipboard = () => {
          $scope.validationError = undefined
          navigator.clipboard.readText().then(text => {
            excelClipboardParser(text).then(text => {
              $scope.selectedModel.table = []
              try {
                text.forEach((row) => {
                  $scope.selectedModel.table.push(numberParser(row))
                })
              } catch (e) {
                $scope.selectedModel.table = []
                $scope.validationError = `Ошибка валидации! ${e.message}`
              }

              $scope.$apply()
            })
          })
        }

        $scope.showDeleteDialog = (modelNum) => {
          if (modelNum >= 0 && modelNum < $scope.referentModels.length) {
            $scope.selectedModelNum = modelNum
            $scope.selectedModel = $scope.referentModels[modelNum]
          } else {
            return
          }

          deleteDialog = new bootstrap.Modal(document.getElementById(`delete_dialog_${$scope.$id}`), {})
          deleteDialog.show()
        }

        $scope.deleteModel = () => {
          $scope.referentModels.splice($scope.selectedModelNum, 1)
          deleteDialog.hide()
        }

        $scope.clear = () => {
          $scope.selectedModel.table = []
        }
      },
      templateUrl: 'templates/widgets/table_editor/referent_table_editor.html'
    }
  })

  mathServer.directive('chartViewer', function () {
    return {
      restrict: 'E',
      scope: {
        series: '='
      },
      transclude: true,
      controller: function ($scope) {
        const canvasEl = document.getElementById('chartContainer')
        $scope.chart = new Chart(canvasEl.getContext('2d'), {
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

        $scope.$watch('series', (newValue) => {
          if (newValue) {
            const colors = ['red', 'green', 'blue', 'gray']
            const data = { labels: $scope.series.labels, datasets: [] }

            $scope.series.datasets.forEach((row, index) => {
              const existingDataset = $scope.chart.data.datasets[index]
              let isHidden = false
              if (existingDataset !== undefined) {
                isHidden = existingDataset.hidden
              }
              data.datasets.push({
                ...row,
                borderWidth: 2,
                pointRadius: 1,
                borderColor: colors[index],
                backgroundColor: colors[index],
                hidden: isHidden
              })
            })

            $scope.chart.data = data
            $scope.chart.update()
          }
        }, true)

        $scope.changeDatatsetVisibility = (datasetIndex) => {
          const dataset = $scope.chart.data.datasets[datasetIndex]
          dataset.hidden = !dataset.hidden
          $scope.chart.update()
        }
      },
      templateUrl: 'templates/widgets/chart_viewer.html'
    }
  })

  mathServer.controller('modelsController', function ($scope, $http, $filter) {
    $scope.grouped_models = {}
    $scope.filtred_models = {}
    $scope.search = ''

    $scope.$watch('search', () => {
      $scope.filtred_models = {}

      angular.forEach($scope.grouped_models, (value, key) => {
        const a = $filter('filter')(value, $scope.search)

        if (a.length > 0) {
          $scope.filtred_models[key] = a
        }
      })
    })

    $scope.loadModels = () => {
      $http.get('/api/math_model').then(response => {
        $scope.grouped_models = response.data
        $scope.filtred_models = $scope.grouped_models
      }, rejection => {})
    }

    $scope.isEmptyObject = (obj) => {
      return (obj && (Object.keys(obj).length === 0))
    }

    $scope.loadModels()
  })

  mathServer.controller('wellproductionmodelController', function ($scope, $http, numberParser, isEmptyObjectChecker) {
    $http.get('/api/math_model/wellproductionmodel').then(response => {
      $scope.modelInstance = response.data
      if (!$scope.modelInstance.input_data) {
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
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(tooltipTriggerEl => {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    })

    $scope.updateChartSeries = () => {
      const res = { labels: [], datasets: [] }
      const productionSeries = { label: 'Прогноз', data: [] }

      angular.forEach($scope.modelInstance.output_data.production_table, row => {
        productionSeries.data.push(row[2])
        res.labels.push(row[0])
      })
      res.datasets.push(productionSeries)
      angular.forEach($scope.modelInstance.input_data.referent_models, (model) => {
        res.datasets.push({
          label: model.name,
          data: model.table
        })
      })
      $scope.chartSeries = res
    }

    $scope.$watch('modelInstance.output_data', (newValue) => {
      if (newValue) {
        $scope.updateChartSeries()
      }
    }, true)

    $scope.$watch('modelInstance.input_data.referent_models', (newValue) => {
      if (newValue) {
        $scope.updateChartSeries()
      }
    }, true)

    $scope.validateInput = () => {
      $scope.validationErrors = {}
      if (!$scope.modelInstance.input_data.niz_table.length) {
        $scope.validationErrors.niz_table = 'Не заполнена таблица "Отбор от НИЗ / Обводнённость"'
      }

      const numberFields = ['kin', 'total', 'debit']
      numberFields.forEach((fieldName) => {
        try {
          numberParser($scope.modelInstance.input_data[fieldName])
        } catch (e) {
          if (e instanceof ValidationError) {
            $scope.validationErrors[fieldName] = `Ошибка валидации! ${e.message}`
          } else throw e
        }
      })
    }

    $scope.calculate = () => {
      $scope.validateInput()
      if (isEmptyObjectChecker($scope.validationErrors)) {
        $scope.isProcessing = true
        $http.put('/api/math_model/wellproductionmodel', $scope.modelInstance.input_data, { headers: { 'Content-Type': 'application/json', charset: 'utf-8' } }).then(
          response => {
            $scope.modelInstance.output_data = response.data
          }, rejection => {
            if (rejection.status === 400) $scope.validationErrors.bad_request_reason = rejection.data.bad_request_reason
          }).finally(() => {
          $scope.isProcessing = false
        })
      }
    }
  })
})(angular, bootstrap)
