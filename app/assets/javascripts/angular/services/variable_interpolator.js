angular.module("Prometheus.services").factory('VariableInterpolator', ["$rootScope", function($rootScope) {
  var re = /{{.+}}/g;
  var re1 = /{{\s?(\w+)\s?}}/g;
  var re2 = /{{\s?\w+\s?(\|\s?\w+(:('|\")?([\sa-zA-Z(\[?=:!^\])]+)?('|\")?){0,}\s?){1,}}}/g;
  function knownFilters() {
    return ["regex", "toPercent", "toPercentile", "hostname"];
  }

  return function(str, varValues) {
    var vars = str.match(re);
    if (!vars) {
      return str;
    }
    vars = vars[0];

    // Deal with filtered variables.
    var pipedVars = vars.match(re2);
    var pipeObj = {};
    if (pipedVars) {
      var scope = $rootScope.$new(true);
      pipedVars.forEach(function(v) { pipeObj[v] = null; });
      pipedVars.forEach(function(match) {
        var rep = match.replace(/\s+/g, '').replace(/{|}/g, '').split("|");

        // Set on scope so we can $eval.
        scope[rep[0]] = varValues[rep[0]]
        // Check to see if rep[1] is in the list of known filters.
        if (knownFilters().indexOf(rep[1].split(":")[0]) > -1) {
          var result = scope.$eval(rep.join("|"));
          pipeObj[match] = result;
          // Remove from scope.
        }
      });
      scope.$destroy();
    }

    // Replace the filtered variables.
    for (var i in pipeObj) {
      str = str.replace(i, pipeObj[i]);
    }

    // Replace the single variables.
    var singleMatches = vars.match(re1);
    if ((singleMatches || []).length) {
      for (var i = 0; i < singleMatches.length; i++) {
        str = str.replace(singleMatches[i], varValues[singleMatches[i].replace(/{|}|\s/g, '')]);
      }
    }
    return str;
  };
}]);

