angular.module("Prometheus.directives").directive('graphChart', ["$location", "WidgetHeightCalculator", "VariableInterpolator", "RickshawDataTransformer", function($location, WidgetHeightCalculator, VariableInterpolator, RickshawDataTransformer) {
  return {
    scope: {
      graphSettings: '=',
      aspectRatio: '=',
      graphData: '=',
      vars: '='
    },
    link: function(scope, element, attrs) {
      var rsGraph = null;
      var legend = null;
      var seriesToggle = null;
      yAxis = null;
      logScale = null;
      linearScale = null;

      function formatTimeSeries(series) {
        series.forEach(function(s) {
          if (!scope.graphSettings.legendFormatString) {
            return;
          }
          s.name = VariableInterpolator(scope.graphSettings.legendFormatString, s.labels);
        });
      }

      function refreshGraph(graph, series) {
        var $el = $(element[0]);
        if (!series.length) {
          $el.empty();
          return;
        }
        graph.series.splice(0, graph.series.length);
        // Remove the onclick handler from each old .action anchor tag, which
        // controls the show/hide action on legend.
        $el.find(".action").each(function() {
          this.onclick = null;
          this.remove();
        });
        $el.find(".legend ul").empty()

        // BUG: If legend items have the same name, they are all assigned the
        // same color after resize.
        // https://github.com/shutterstock/rickshaw/blob/master/src/js/Rickshaw.Series.js#L73
        // The same object is returned each time from itemByName().
        // Our vendored Rickshaw file is edited at comments /*stn*/ to fix
        // this.
        formatTimeSeries(series);
        setLegendPresence(series);

        graph.series.load({items: series});

        // TEMP DUPLICATED MULTI-AXIS STUFF
        // Check out yaxis.vis, try to empty that for re-rendering
        //
        // Also check out yaxis._renderHeight, that might be able to fix the
        // issue where the yaxis is rendering too low because we are
        // artificially setting the minimum at 0 when it really isn't that low.
        var leftAxisSettings = scope.graphSettings.axes[0];
        var rightAxisSettings = scope.graphSettings.axes[1];

        var leftScale = leftAxisSettings.scale === "log" ? logScale : linearScale;
        var leftTickFormat = leftAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;
        debugger
        yAxis.scale = leftScale

        // Series toggle is leaking.
        (seriesToggle || {}).legend = null;
        seriesToggle = null;
        seriesToggle = new Rickshaw.Graph.Behavior.Series.Toggle({
          graph: graph,
          legend: legend
        });

        graph.configure({
          renderer: scope.graphSettings.stacked ? 'stack' : 'line',
          interpolation: scope.graphSettings.interpolationMethod,
          height: calculateGraphHeight($el.find(".legend"))
        });

        graph.render();
      }

      function redrawGraph() {
        // Graph height is being set irrespective of legend.
        var graphHeight = WidgetHeightCalculator(element[0], scope.aspectRatio);
        $(element[0]).css('height', graphHeight);

        if (scope.graphData == null) {
          return;
        }

        var series = RickshawDataTransformer(scope.graphData, scope.graphSettings.stacked, scope.graphSettings.axes);

        var seriesYLimitFn = calculateBound(series);
        var yMinForLog = seriesYLimitFn(Math.min);
        var yMin = yMinForLog > 0 ? 0 : yMinForLog;
        var yMax = seriesYLimitFn(Math.max);

        // TODO: Put this into its own service
        logScale = d3.scale.log().domain([yMinForLog, yMax]);
        linearScale = d3.scale.linear().domain([yMin, yMax]).range(logScale.range());
        series.forEach(function(s) {
          var matchingAxis = scope.graphSettings.axes.filter(function(a) {
            return a.id === s.axis_id
          })[0];
          var scaleSetting = (matchingAxis || {}).scale;

          delete s.axis_id
          if (scaleSetting === "log") {
            s.scale = logScale;
          } else {
            s.scale = linearScale;
          }
        });

        if (rsGraph) {
          refreshGraph(rsGraph, series);
          return;
        }

        if (series.length === 0) {
          return;
        }

        formatTimeSeries(series);
        setLegendPresence(series);

        rsGraph = new Rickshaw.Graph({
          element: element[0],
          min: yMin,
          interpolation: scope.graphSettings.interpolationMethod,
          renderer: (scope.graphSettings.stacked ? 'stack' : 'line'),
          series: series
        });

        var $legend = $(element[0]).find(".legend");
        legend = createLegend(rsGraph, $legend[0]);

        seriesToggle = new Rickshaw.Graph.Behavior.Series.Toggle({
          graph: rsGraph,
          legend: legend
        });

        // Set legend elements to maximum element width so they line up.
        var $legendElements = $legend.find(".line");
        var widths = $legendElements.map(function(i, el) {
          return el.clientWidth
        });

        var maxWidth = Math.max.apply(Math, widths);
        $legendElements.css("width", maxWidth);

        // TODO: Figure out why mouseleave changes graph elements to same color
        // On legend element mouseleave, all graph elements change to same fill color
        // var highlighter = new Rickshaw.Graph.Behavior.Series.Highlight({
        //   graph: rsGraph,
        //   legend: legend
        // });

        rsGraph.configure({height: calculateGraphHeight($legend)});
        rsGraph.series.legend = legend;

        var xAxis = new Rickshaw.Graph.Axis.Time({
          graph: rsGraph
        });
        xAxis.render();

        // TODO: Axes are being weird. They are calculated for the range of the
        // series, but we are setting the minimum of the graph to 0 if the min
        // is greater than 0, thereby causing the axis to be off.
        // var parentEl = element[0].parentElement;
        // have this work off scope.axes.first
        // this left one is always the left axis
        // and the second is always the right
        var leftAxisSettings = scope.graphSettings.axes[0];
        var rightAxisSettings = scope.graphSettings.axes[1];

        var leftScale = leftAxisSettings.scale === "log" ? logScale : linearScale;
        var leftTickFormat = leftAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;
        var yAxisLeft = {
          graph: rsGraph,
          orientation: 'right',
          tickFormat: leftTickFormat,
          // element: parentEl.querySelector('.y_axis.left'),
          scale: leftScale
          // scale: linearScale
        };
        yAxis = new Rickshaw.Graph.Axis.Y.Scaled(yAxisLeft);
        // var yAxisRight = {
        //   graph: rsGraph,
        //   orientation: 'left',
        //   tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
        //   // element: parentEl.querySelector('.y_axis.right'),
        //   scale: logScale
        // };
        // yAxis = new Rickshaw.Graph.Axis.Y.Scaled(yAxisRight);
        // yAxis.render();

        var hoverDetail = new Rickshaw.Graph.HoverDetail({
          graph: rsGraph,
          formatter: function(series, x, y) {
            var date = '<span class="date">' + new Date(x * 1000).toUTCString() + '</span>';
            var swatch = '<span class="detail_swatch" style="background-color: ' + series.color + '"></span>';
            var content = swatch + series.labels["__name__"] + ": <strong>" + y + '</strong>';
            return date + '<br>' + content + '<br>' + renderLabels(series.labels);
          },
          onRender: function() {
            var dot = this.graph.element.querySelector('.dot');
            var hoverContent = this.graph.element.querySelector('.item');

            dot.style.top = parseFloat(dot.style.top) + elementHeight($legend) + "px";
            hoverContent.style.top = parseFloat(hoverContent.style.top) + elementHeight($legend) + "px";
          },
        });
        rsGraph.render();
      }

      function elementHeight($element) {
        return $element.outerHeight(true);
      }

      function calculateBound(series) {
        var yValues = series.map(function(s) {
          return s.data.map(function(d) {
            return d.y;
          });
        });
        var flatYValues = d3.merge(yValues);
        return function(bound) {
          var limit = bound.apply(Math, flatYValues);
          return limit;
        }
      }

      function setLegendPresence(series) {
        $(element[0]).find(".legend").show();
        if (scope.graphSettings.legendSetting === "never" ||
            (scope.graphSettings.legendSetting === "sometimes" && series.length > 5)) {
          $(element[0]).find(".legend").hide();
          series.forEach(function(s) {
            s.noLegend = true;
          });
        }
      }

      function createLegend(graph, element) {
        return new Rickshaw.Graph.Legend({
          graph: graph,
          element: element
        });
      }

      function calculateGraphHeight($legend) {
        var graphHeight = WidgetHeightCalculator(element[0], scope.aspectRatio);
        var height = graphHeight - elementHeight($legend);
        if (height < 1) height = 1;
        return height;
      }

      function renderLabels(labels) {
        var labelStrings = [];
        for (label in labels) {
          if (label != "__name__") {
            labelStrings.push("<strong>" + label + "</strong>: " + labels[label]);
          }
        }
        return labels = "<div class=\"labels\">" + labelStrings.join("<br>") + "</div>";
      }

      scope.$watch('graphSettings.stacked', redrawGraph);
      scope.$watch('graphSettings.interpolationMethod', redrawGraph);
      scope.$watch('graphSettings.legendSetting', redrawGraph);
      scope.$watch('graphSettings.legendFormatString', redrawGraph);
      scope.$watch('graphSettings.axes', redrawGraph, true);
      scope.$watch('graphData', redrawGraph, true);
      scope.$on('redrawGraphs', function() {
        redrawGraph();
      });
    },
  };
}]);
