angular.module("Prometheus.filters").filter('toPercent', function() {
  return function(input) {
    return parseFloat(input, 10) * 100 + "%";
  }
});

angular.module("Prometheus.filters").filter('toInt', function() {
  return function(input) {
    return parseInt(input*100, 10);
  }
});

angular.module("Prometheus.filters").filter('hostname', function() {
  return function(input) {
    var a = document.createElement("a");
    a.href = input;
    return a.host;
  }
});
