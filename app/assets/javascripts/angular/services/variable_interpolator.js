angular.module("Prometheus.services").factory('VariableInterpolator', function() {
  var re = /{{.+}}/g;
  var re1 = /{{\s?(\w+)\s?}}/g;
  var re2 = /{{\s?\w+\s?(\|\s?\w+\s?}})/g;
  //save me
  //{{\s?\w+\s?(\|\s?\w+\s?}})

  return function(str, varValues) {
    function toPercent(label) {
      return parseFloat(label, 10) * 100 + "%";
    }
    function toInt(label) {
      return parseInt(label, 10) * 100;
    }

    var vars = str.match(re);
    if (!vars) {
      return str;
    }

    var pipedVars = [];
    vars.map(function(v) {
      var match = v.match(re2)
      if (match) {
        pipedVars = pipedVars.concat(match)
      }
    });

    var pipeObj = {};
    if (pipedVars.length) {
      // put in keys so we can replace by them later
      // replace with Object.keys(pipedVars)
      pipedVars.forEach(function(v) { pipeObj[v] = null; });
      var newStr = str
      pipedVars.forEach(function(match) {
        var rep = match.replace(/\s+/g, '').replace(/{|}/g, '').match(/\s?(\w+)|(\w+)\s?/g)
        // getting double matches???
        eval("var fn = " + rep[1]);
        // set the value on the key in the pipe obj to the evaluation of the
        // filter function
        pipeObj[match] = fn(varValues[rep[0]])
      });
      // have to know that there is a pipe to diverge the matching path
    }

    for (var i in pipeObj) {
      str = str.replace(i, pipeObj[i])
    }
    for (var i = 0; i < vars.length; i++) {
      str = str.replace(vars[i], varValues[vars[i].replace(/{|}/g, '')]);
    }
    debugger
    return str;
  };
});
