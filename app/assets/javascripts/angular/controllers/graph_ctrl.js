angular.module("Prometheus.controllers").controller('GraphCtrl', ["$scope", "$http", "$window", "VariableInterpolator", "UrlHashEncoder", "GraphRefresher", "InputHighlighter", "ServersByIdObject", "WidgetLinkHelper", function($scope, $http, $window, VariableInterpolator, UrlHashEncoder, GraphRefresher, InputHighlighter, ServersByIdObject, WidgetLinkHelper) {
  $scope.generateWidgetLink = function(event) {
    if ($scope.showTab !== 'staticlink') {
      return;
    }
    var graphBlob = {};
    graphBlob.widget = $scope.graph;
    graphBlob.globalConfig = dashboardData.globalConfig;
    WidgetLinkHelper
      .createLink({
         encoded_url: UrlHashEncoder(graphBlob),
         graph_title: $scope.graph.title,
         dashboard_name: dashboardName
       }, event)
      .setLink($scope)
      .highlightInput(event);
  };

  $scope.graph.legendSetting = $scope.graph.legendSetting || "sometimes";
  $scope.graph.interpolationMethod = $scope.graph.interpolationMethod || "cardinal";

  $scope.serversById = ServersByIdObject($scope.servers);
  $scope.graph.axes = [];
  $scope.requestsInFlight = 0;
  $scope.data = null;

  $scope.removeGraph = function() {
    $scope.$emit('removeWidget', $scope.index);
  };

  $scope.toggleTab = function(tab) {
    $scope.showTab = $scope.showTab == tab ? null : tab;
  };

  $scope.addExpression = function() {
    var serverId = 0;
    var axisId = 0;
    if ($scope.graph.expressions.length != 0) {
      var prev = $scope.graph.expressions[$scope.graph.expressions.length-1];
      serverId = prev['server_id'];
      axisId = prev['axis_id'];
    } else if ($scope.servers.length != 0) {
      serverId = $scope.servers[0]['id'];
      axisId = $scope.graph.axes[0]['id'];
    }

    var exp = {
      'server_id': serverId,
      'axis_id': axisId,
      'expression': ''
    };
    $scope.graph.expressions.push(exp);
    var url = $scope.serversById[serverId]['url'];
  };

  $scope.$on('removeExpression', function(ev, index) {
    $scope.graph.expressions.splice(index, 1);
  });

  $scope.addAxis = function() {
    var len = $scope.graph.axes.push(Prometheus.Graph.getAxisDefaults());
    $scope.graph.axes[len-1]['id'] = len;
  };

  $scope.removeAxis = function(idx) {
    var len = $scope.graph.axes.length;
    if (len == 1) {
      alert('Cannot remove last axis');
      return;
    }

    $scope.graph.axes.splice(idx, 1);
    for (var i = 0; i < len-1; i++) {
      $scope.graph.axes[i]['id'] = i + 1;
    }
  };

  $scope.$on('setRange', function(ev, range) {
    $scope.graph.range = range;
    $scope.refreshGraph();
  });

  $scope.$on('setEndTime', function(ev, endTime) {
    $scope.graph.endTime = endTime;
    $scope.refreshGraph();
  });

  $scope.$on('refreshDashboard', function(ev) {
    $scope.refreshGraph();
  });

  $scope.title = function() {
    return VariableInterpolator($scope.graph.title, $scope.vars);
  };

  $scope.refreshGraph = GraphRefresher($scope);

  if ($scope.graph.axes.length == 0) {
    $scope.addAxis();
  }

  $scope.refreshGraph();
}]);
