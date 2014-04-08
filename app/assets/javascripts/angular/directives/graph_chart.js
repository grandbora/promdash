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
      var yAxis = null;
      var yAxis2 = null;
      var logScale = null;
      var linearScale = null;

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

        // Series toggle is leaking.
        (seriesToggle || {}).legend = null;
        seriesToggle = null;
        seriesToggle = new Rickshaw.Graph.Behavior.Series.Toggle({
          graph: graph,
          legend: legend
        });

        graph.configure({
          interpolation: scope.graphSettings.interpolationMethod,
          height: calculateGraphHeight($el.find(".legend"))
        });

        var leftAxisSettings = scope.graphSettings.axes[0];
        var rightAxisSettings = scope.graphSettings.axes[1];

        if (yAxis) {
          var scale = leftAxisSettings.scale === "log" ? logScale : linearScale;
          var tickFormat = leftAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;
          yAxis.scale = scale
          yAxis.tickFormat = tickFormat
        }
        // Don't re-render right Y-axis if it was removed.
        if (scope.graphSettings.axes.length > 1 && yAxis2) {
          var scale = rightAxisSettings.scale === "log" ? logScale : linearScale;
          var tickFormat = rightAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;
          yAxis2.scale = scale
          yAxis2.tickFormat = tickFormat
          yAxis2.height = rsGraph.height
          yAxis2.width = rsGraph.width
        }

        graph.render();
      }

      function redrawGraph() {
        // Graph height is being set irrespective of legend.
        var graphHeight = WidgetHeightCalculator(element[0], scope.aspectRatio);
        $(element[0]).css('height', graphHeight);

        if (scope.graphData == null) {
          return;
        }

        var series = RickshawDataTransformer(scope.graphData, scope.graphSettings.axes);

        // TODO: Put this into its own service
        var seriesYLimitFn = calculateBound(series);
        var yMinForLog = seriesYLimitFn(Math.min);
        var yMin = yMinForLog > 0 ? 0 : yMinForLog;
        var yMax = seriesYLimitFn(Math.max);

        logScale = d3.scale.log().domain([yMinForLog, yMax]);
        linearScale = d3.scale.linear().domain([yMin, yMax]).range(logScale.range());
        series.forEach(function(s) {
          var matchingAxis = scope.graphSettings.axes.filter(function(a) {
            return a.id === s.axis_id
          })[0];
          matchingAxis = matchingAxis || {};

          delete s.axis_id
          s.scale = matchingAxis.scale === "log" ? logScale : linearScale;

          if (matchingAxis.renderer) {
            s.renderer = matchingAxis.renderer;
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
          renderer: 'multi',
          min: yMin,
          interpolation: scope.graphSettings.interpolationMethod,
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

        var leftAxisSettings = scope.graphSettings.axes[0];
        var rightAxisSettings = scope.graphSettings.axes[1];

        var leftScale = leftAxisSettings.scale === "log" ? logScale : linearScale;
        var leftTickFormat = leftAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;
        var rightScale, rightTickFormat;

        var yAxisLeft = {
          graph: rsGraph,
          orientation: 'right',
          tickFormat: leftTickFormat,
          scale: leftScale
        };
        yAxis = new Rickshaw.Graph.Axis.Y.Scaled(yAxisLeft);

        if (rightAxisSettings) {
          rightScale = rightAxisSettings.scale === "log" ? logScale : linearScale;
          rightTickFormat = rightAxisSettings.format === "kmbt" ? Rickshaw.Fixtures.Number.formatKMBT : null;

          var yAxisRight = {
            graph: rsGraph,
            orientation: 'left',
            tickFormat: rightTickFormat,
            scale: rightScale
          };
          yAxis2 = new Rickshaw.Graph.Axis.Y.Scaled(yAxisRight);
          yAxis2.height = rsGraph.height
          yAxis2.width = rsGraph.width
          yAxis2.berthRate = 0
        }

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
