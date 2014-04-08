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

  // TODO: Set these on graph creation so we don't have to keep doing these
  // checks
  $scope.graph.legendSetting = $scope.graph.legendSetting || "sometimes";
  $scope.graph.interpolationMethod = $scope.graph.interpolationMethod || "cardinal";
  $scope.graph.axes = $scope.graph.axes || [];

  $scope.serversById = ServersByIdObject($scope.servers);
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

  $scope.increaseRange = function() {
    $scope.graph.range = Prometheus.Graph.nextLongerRange($scope.graph.range);
  };

  $scope.decreaseRange = function() {
    $scope.graph.range = Prometheus.Graph.nextShorterRange($scope.graph.range);
  };

  $scope.increaseEndTime = function() {
    $scope.graph.endTime = Prometheus.Graph.laterEndTime($scope.graph.endTime, $scope.graph.range);
  };

  $scope.decreaseEndTime = function() {
    $scope.graph.endTime = Prometheus.Graph.earlierEndTime($scope.graph.endTime, $scope.graph.range);
  };

  $scope.addAxis = function() {
    var len = $scope.graph.axes.push(Prometheus.Graph.getAxisDefaults());
    $scope.graph.axes[len-1]['id'] = len;
  };

  $scope.removeAxis = function(idx) {
    var axes = $scope.graph.axes;
    var len = axes.length;
    if (len === 1) {
      alert('Cannot remove last axis');
      return;
    }

    $scope.graph.expressions.forEach(function(expr) {
      if (expr.axis_id === axes[idx].id) {
        expr.axis_id = axes[0].id
      }
    });

    axes.splice(idx, 1);
    for (var i = 0; i < len-1; i++) {
      axes[i]['id'] = i + 1;
    }
  };

  $scope.$on('setRange', function(ev, range) {
    $scope.graph.range = range;
    $scope.refreshGraph();
  });

  $scope.$watch('globalEndTime', function() {
    $scope.graph.endTime = $scope.globalEndTime;
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
}]);
