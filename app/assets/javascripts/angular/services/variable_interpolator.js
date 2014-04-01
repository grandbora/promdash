angular.module("Prometheus.services").factory('VariableInterpolator', function() {
  var re = /{{.+}}/g;
  var re1 = /{{\s?(\w+)\s?}}/g;
  var re2 = /{{\s?\w+\s?(\|\s?\w+\s?}})/g;

  return function(str, varValues) {
    function toPercent(label) {
      return parseFloat(label, 10) * 100 + "%";
    }
    function toInt(label) {
      return parseInt(label*100, 10);
    }

    var vars = str.match(re);
    if (!vars) {
      return str;
    }
    vars = vars[0]

    // Deal with filtered variables.
    var pipedVars = [];
    var filteredMatches = vars.match(re2)
    if (filteredMatches) {
      pipedVars = pipedVars.concat(filteredMatches)
    }

    var pipeObj = {};
    if (pipedVars.length) {
      pipedVars.forEach(function(v) { pipeObj[v] = null; });
      var newStr = str
      pipedVars.forEach(function(match) {
        var rep = match.replace(/\s+/g, '').replace(/{|}/g, '').match(/\s?(\w+)|(\w+)\s?/g)
        // catch when rep[1] isn't a function
        eval("var fn = " + rep[1]);
        pipeObj[match] = fn(varValues[rep[0]])
      });
    }

    // Replace the filtered variables.
    for (var i in pipeObj) {
      str = str.replace(i, pipeObj[i])
    }

    // Replace the single variables.
    var singleMatches = vars.match(re1)
    if ((singleMatches || []).length) {
      for (var i = 0; i < singleMatches.length; i++) {
        str = str.replace(singleMatches[i], varValues[singleMatches[i].replace(/{|}/g, '')]);
      }
    }
    return str;
  };
});
