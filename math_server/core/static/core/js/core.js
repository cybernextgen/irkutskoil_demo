/* global bootstrap, angular, Chart */
(function (angular, bootstrap) {
  class ValidationError extends Error { }

  const mathServer = angular.module('mathServer', ['ui.router', 'ngclipboard'])

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
      }).state('simplecalculatormodel', {
        url: '/models/simplecalculatormodel',
        templateUrl: 'templates/simplecalculatormodel.html',
        controller: 'simplecalculatormodelController'
      }).state('asynccalculatormodel', {
        url: '/models/asynccalculatormodel',
        templateUrl: 'templates/asynccalculatormodel.html',
        controller: 'asynccalculatormodelController'
      }).state('vnswellmodel', {
        url: '/models/vnswellmodel',
        templateUrl: 'templates/vnswellmodel.html',
        controller: 'vnswellmodelController'
      }).state('nsi', {
        url: '/nsi',
        templateUrl: 'templates/nsi.html',
        controller: 'nsiController'
      })
    }])

  mathServer.factory('userPermissionsStorage', function ($http, isEmptyObjectChecker) {
    let userPermissions = {};
    const permissionPromise = new Promise((resolve, reject) => {
      if (isEmptyObjectChecker(userPermissions)) {
        $http.get('/api/permissions').then(response => {
          for (const perm of response.data) {
            userPermissions[perm] = true
          }
          resolve(userPermissions)
        }, rejectionReason => {
          reject(rejectionReason)
        });
      } else {
        resolve(userPermissions)
      }
    })

    return {
      getPermissions: () => {
        return permissionPromise;
      }
    };
  });

  mathServer.directive('userHasPermission', ['userPermissionsStorage', function (userPermissionsStorage) {

    function link(scope, element, attrs) {
      const requestedPermission = attrs['userHasPermission']
      userPermissionsStorage.getPermissions().then(permissionsObject => {
        if (!permissionsObject[requestedPermission]) {
          element.addClass('d-none')
        }
      })
    }

    return {
      link: link
    };
  }]);

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
            return colAsText.trim().replace(/^"(.*)"$/, '$1').replace(',', '.')
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

  mathServer.filter('roundTo', function (numberFilter) {
    return (value, maxDecimals) => {
      return value.toFixed(maxDecimals).replace(/(?:\.0+|(\.\d+?)0+)$/, '$1')
    }
  })

  mathServer.factory('ruLocaleDateParser', function () {
    return text => {
      if (!text) throw new ValidationError('Дата не указана')
      const splittedDateString = text.split('.')
      const date = new Date(`${splittedDateString[2]}-${splittedDateString[1]}-${splittedDateString[0]}`)
      if (isNaN(date)) throw new ValidationError(`Неверный формат даты: ${text}. Укажите дату в формате ДД.ММ,ГГГГ`)
      return date
    }
  })

  mathServer.factory('numberParser', function () {
    return text => {
      if (text === null || text === '') throw new ValidationError('Значение не указано')
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
            }, (rejection) => {
              $scope.validationError = `Ошибка парсинга! ${rejection.message}`
            })
          }, () => {
            $scope.validationError = 'Ограничен доступ к буферу обмена. Измените настройки браузера для продолжения работы.'
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
            }, (rejection) => {
              $scope.validationError = `Ошибка парсинга! ${rejection.message}`
            })
          }, () => {
            $scope.validationError = 'Ограничен доступ к буферу обмена. Измените настройки браузера для продолжения работы.'
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

  mathServer.directive('notificationViewer', function () {
    return {
      restrict: 'E',
      scope: {
        limit: '='
      },
      transclude: true,
      controller: function ($scope, $http, $filter) {
        $scope.notifications = []
        $scope.popoverHTML = ''
        $scope.isPopoverShown = false
        const popoverConfig = {
          trigger: 'focus',
          html: true,
          content: () => $scope.popoverHTML,
          fallbackPlacements: ['bottom'],
          placement: 'bottom'
        }
        const popoverTrigger = document.getElementById('notification_popover')
        let popoverInstance = new bootstrap.Popover(popoverTrigger, popoverConfig)
        $scope.generatePopoverHTML = () => {
          $scope.popoverHTML = '<h5>Последние уведомления</h5>'
          if ($scope.notifications.length) {
            $scope.popoverHTML += '<ul class="list-group">'
            $scope.notifications.forEach((notification) => {
              const timestamp = $filter('date')(notification.created_timestamp, 'dd.MM.yy HH:mm')
              const statusClass = notification.is_success ? 'list-group-item-success' : 'list-group-item-danger'
              $scope.popoverHTML += `<li class="list-group-item ${statusClass}"><h6>${timestamp}</h6> ${notification.description}</li>`
            })
            $scope.popoverHTML += '</ul>'
          } else {
            $scope.popoverHTML += '<p class="text-muted">У Вас нет уведомлений</p>'
          }
        }

        $scope.handlePopover = () => {
          popoverInstance.toggle()
          if ($scope.isPopoverShown && $scope.notifications.length) {
            setTimeout(() => {
              if ($scope.isPopoverShown) {
                $http.put('/api/notification', $scope.notifications.map((n) => n.id), { headers: { 'Content-Type': 'application/json', charset: 'utf-8' } })
              }
            }, 2000)
          }
        }

        $scope.updatePopover = () => {
          if (!$scope.isPopoverShown) {
            popoverInstance.dispose()
            popoverInstance = new bootstrap.Popover(popoverTrigger, popoverConfig)

            popoverTrigger.addEventListener('show.bs.popover', function () {
              $scope.isPopoverShown = true
            })
            popoverTrigger.addEventListener('hidden.bs.popover', function () {
              $scope.isPopoverShown = false
            })
          }
        }

        $scope.loadNotifications = () => {
          $http.get('/api/notification/new/3').then(response => {
            $scope.notifications = response.data
            $scope.generatePopoverHTML()
            $scope.updatePopover()
          }, () => { })
        }
        setInterval(() => { $scope.loadNotifications() }, 10000)

        $scope.loadNotifications()
      },
      templateUrl: 'templates/widgets/notification_viewer.html'
    }
  })

  mathServer.controller('modelsController', function ($scope, $http, $filter, userPermissionsStorage) {
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
        userPermissionsStorage.getPermissions().then(permissionsObject => {
          let allowedGroups = {}
          angular.forEach(response.data, (group, groupName) => {
            let allowedModels = []
            angular.forEach(group, model => {
              if (permissionsObject[`core.view_${model.id}`]) {
                allowedModels.push(model)
              }
            })
            if (allowedModels.length > 0) {
              allowedGroups[groupName] = allowedModels
            }
          })
          $scope.grouped_models = allowedGroups
          $scope.filtred_models = $scope.grouped_models
          $scope.$apply()
        })
      }, rejection => { })
    }

    $scope.isEmptyObject = (obj) => {
      return (obj && (Object.keys(obj).length === 0))
    }

    $scope.loadModels()
  })

  mathServer.controller('wellproductionmodelController', function ($scope, $http, numberParser, isEmptyObjectChecker, $filter) {
    $scope.dataIsReady = false

    $scope.modelIsAvailable = false

    $http.get('/api/math_model/wellproductionmodel').then(response => {
      $scope.modelInstance = response.data
      if (isEmptyObjectChecker($scope.modelInstance.input_data)) {
        $scope.modelInstance.input_data = {
          niz_table: [],
          kin: 0,
          total: 0,
          debit: 0,
          referent_models: []
        }
      }
    }).then(successResponse => {
      $scope.modelIsAvailable = true
    }, errorResponse => {
      $scope.modelIsAvailable = false
      $scope.errorText = `Ошибка ${errorResponse.status}: ${errorResponse.data || errorResponse.statusText}`
    }).finally(() => {
      $scope.dataIsReady = true
    })

    $scope.isProcessing = false
    $scope.chartSeries = {}
    $scope.validationErrors = {}
    $scope.copyToClipboardButtonsState = {}

    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    tooltipTriggerList.map(tooltipTriggerEl => {
      return new bootstrap.Tooltip(tooltipTriggerEl)
    })

    $scope.updateChartSeries = () => {
      const res = { labels: [], datasets: [] }
      const productionSeries = { label: 'Прогноз', data: [] }

      angular.forEach($scope.modelInstance.output_data.production_table, row => {
        productionSeries.data.push(row[2])
        res.labels.push($filter('date')(row[0], 'dd.MM.yy'))
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

    $scope.onCopyToClipboardSuccess = (e) => {
      const buttonId = e.trigger.id
      if (buttonId) $scope.copyToClipboardButtonsState[e.trigger.id] = true
      e.clearSelection()
    }

    $scope.onCopyToClipboardError = (e) => {
      e.clearSelection()
    }
  })

  mathServer.controller('simplecalculatormodelController', function ($scope, $http, numberParser, isEmptyObjectChecker) {
    $scope.dataIsReady = false

    $scope.modelIsAvailable = false

    $scope.operationsAvailable = [
      { id: 'add', label: 'Сложение' },
      { id: 'sub', label: 'Вычитание' },
      { id: 'mul', label: 'Умножение' },
      { id: 'div', label: 'Деление' }
    ]
    $scope.validationErrors = {}

    const operationsMap = {}
    $scope.operationsAvailable.forEach((operationObject) => {
      operationsMap[operationObject.id] = operationObject
    })

    $http.get('/api/math_model/simplecalculatormodel').then(response => {

      $scope.modelInstance = response.data

      if (isEmptyObjectChecker($scope.modelInstance.input_data)) {
        $scope.modelInstance.input_data = {
          val1: 0,
          val2: 0,
          op: $scope.operationsAvailable[0]
        }
      } else {
        $scope.modelInstance.input_data.op = operationsMap[$scope.modelInstance.input_data.op] || $scope.operationsAvailable[0]
      }
    }).then(successResponse => {
      $scope.modelIsAvailable = true
    }, errorResponse => {
      $scope.modelIsAvailable = false
      $scope.errorText = `Ошибка ${errorResponse.status}: ${errorResponse.data || errorResponse.statusText}`
    }).finally(() => {
      $scope.dataIsReady = true
    })

    $scope.validateInput = () => {
      $scope.validationErrors = {}
      const numberFields = ['val1', 'val2']
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
        const dataToSend = { ...$scope.modelInstance.input_data }
        dataToSend.op = dataToSend.op.id
        $http.put('/api/math_model/simplecalculatormodel', dataToSend, {
          headers: {
            'Content-Type': 'application/json',
            charset: 'utf-8'
          }
        }).then(
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

  mathServer.controller('asynccalculatormodelController', function ($scope, $http, numberParser, isEmptyObjectChecker) {
    $scope.dataIsReady = false

    $scope.modelIsAvailable = false


    $scope.operationsAvailable = [
      { id: 'add', label: 'Сложение' },
      { id: 'sub', label: 'Вычитание' },
      { id: 'mul', label: 'Умножение' },
      { id: 'div', label: 'Деление' }
    ]
    $scope.validationErrors = {}

    $scope.loadModel = () => {
      $http.get('/api/math_model/asynccalculatormodel').then(response => {
        const operationsMap = {}
        $scope.operationsAvailable.forEach((operationObject) => {
          operationsMap[operationObject.id] = operationObject
        })
        $scope.modelInstance = response.data
        if (isEmptyObjectChecker($scope.modelInstance.input_data)) {
          $scope.modelInstance.input_data = {
            val1: 0,
            val2: 0,
            op: $scope.operationsAvailable[0]
          }
          $scope.modelInstance.is_ready = false
          $scope.modelInstance.is_processing = false
        } else {
          $scope.modelInstance.input_data.op = operationsMap[$scope.modelInstance.input_data.op] || $scope.operationsAvailable[0]
        }
      }).then(successResponse => {
        $scope.modelIsAvailable = true
      }, errorResponse => {
        $scope.modelIsAvailable = false
        $scope.errorText = `Ошибка ${errorResponse.status}: ${errorResponse.data || errorResponse.statusText}`
      }).finally(() => {
        $scope.dataIsReady = true
      })
    }

    $scope.validateInput = () => {
      $scope.validationErrors = {}
      const numberFields = ['val2']
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

    $scope.$watch('modelInstance.is_processing', (newValue) => {
      if (newValue !== undefined) {
        if ($scope.modelInstance.is_processing === true) {
          $scope.interval = setInterval(() => {
            $scope.loadModel()
          }, 2000)
        } else {
          clearInterval($scope.interval)
        }
      }
    })

    $scope.calculate = () => {
      $scope.validateInput()
      if (isEmptyObjectChecker($scope.validationErrors)) {
        $scope.modelInstance.is_processing = true
        const dataToSend = { ...$scope.modelInstance.input_data }
        dataToSend.op = dataToSend.op.id
        $http.put('/api/math_model/asynccalculatormodel', dataToSend, {
          headers: {
            'Content-Type': 'application/json',
            charset: 'utf-8'
          }
        })
      }
    }
    $scope.loadModel()
  })

  mathServer.controller('nsiController', function ($scope, $http, $filter) {
    $scope.importIsPending = false
    $scope.employeeToShow = {}

    $scope.importData = () => {
      $http.put('/api/nsi_data_import', {}, {
        headers: {
          'Content-Type': 'application/json',
          charset: 'utf-8'
        }
      }).finally(() => {
        $scope.importIsPending = false
        $scope.loadEmployees()
      })
      $scope.importIsPending = true
    }

    $scope.getImportStatus = () => {
      $http.get('/api/nsi_data_import').then((response) => {
        if (response.status == 202) {
          $scope.importIsPending = true
          const importStatus = response.data
          const timestamp = $filter('date')(importStatus.created_timestamp, 'dd.MM.yy в HH:mm')
          $scope.pendingMessage = `Пользователь ${importStatus.user} инициировал импорт данных ${timestamp}`
        }
      })
    }

    $scope.loadEmployees = () => {
      $http.get('/api/nsi_data/10').then((response) => {
        $scope.employees = response.data
        console.log($scope.employees)
      })
    }

    let modalInstance

    $scope.showEmployee = (employee) => {
      $scope.employeeToShow = employee
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

    $scope.getImportStatus()
    $scope.loadEmployees()
  })
})(angular, bootstrap)
