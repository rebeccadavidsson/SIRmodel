// Create a namespace to contain all of the variables and functions.
var SIR = SIR || {};

SIR.solve = function(popn, s_frac, lockdown, R0, lat_durn, inf_durn, res_durn, eta, n) {
    var s = new Float64Array(n + 1),
        e = new Float64Array(n + 1),
        i = new Float64Array(n + 1),
        r = new Float64Array(n + 1);
    s[0] = s_frac * (1.0 - 1.0 / popn);
    e[0] = 1.0 / popn;
    i[0] = 0.0;
    r[0] = Math.max(0.0, 1.0 - s[0] - e[0] - i[0]);

    // var R_0 = function() {
    //     if lockdown <
    // }

    var beta = R0 / inf_durn;

    var s_to_e = function(s, e, i, r) {
        return(beta * Math.pow(s, eta) * i);
    };

    var e_to_i = function(s, e, i, r) {
        return(e / lat_durn);
    };

    var i_to_r = function(s, e, i, r) {
        return(i / inf_durn);
    };

    var r_to_s = function(s, e, i, r) {
        if (res_durn <= 0) {
            return(0);
        }
        return(r / res_durn);
    };

    // Index variable for several loops, below.
    var ix;
    for (ix = 0; ix < n; ix++) {
        
        // Integrate using forward Euler, enforces an upper bound on dt.
        var sub_steps = 10;
        var dt = 1.0 / sub_steps;
        var s_pr = s[ix],
            e_pr = e[ix],
            i_pr = i[ix],
            r_pr = r[ix];

        if (lockdown < ix) {
            beta = R0 / inf_durn;
        }
        else {
            beta = R0 + 0.07 / inf_durn;
        }

        for (var j = 0; j < sub_steps; j++) {
            var to_e = dt * s_to_e(s_pr, e_pr, i_pr, r_pr);
            var to_i = dt * e_to_i(s_pr, e_pr, i_pr, r_pr);
            var to_r = dt * i_to_r(s_pr, e_pr, i_pr, r_pr);
            var to_s = dt * r_to_s(s_pr, e_pr, i_pr, r_pr);
            s[ix + 1] = s_pr + to_s - to_e;
            e[ix + 1] = e_pr + to_e - to_i;
            i[ix + 1] = i_pr + to_i - to_r;
            r[ix + 1] = r_pr + to_r - to_s;
            s_pr = s[ix + 1];
            e_pr = e[ix + 1];
            i_pr = i[ix + 1];
            r_pr = r[ix + 1];
        }
    }

    var data_S = [],
        data_E = [],
        data_I = [],
        data_R = [],
        data_max = 0.0;

    // Convert from population fractions to percentages.
    var scale_by = 100;

    for (ix = 0; ix < n + 1; ix++) {
        data_S.push({x: ix, y: scale_by * s[ix]});
        data_E.push({x: ix, y: scale_by * e[ix]});
        data_I.push({x: ix, y: scale_by * i[ix]});
        data_R.push({x: ix, y: scale_by * r[ix]});
        if (data_S[ix].y > data_max) { data_max = data_S[ix].y; }
        if (data_E[ix].y > data_max) { data_max = data_E[ix].y; }
        if (data_I[ix].y > data_max) { data_max = data_I[ix].y; }
        if (data_R[ix].y > data_max) { data_max = data_R[ix].y; }
    }

    // Return lists of objects for use with D3.
    data_max = scale_by;
    return({s: data_S, e: data_E, i: data_I, r: data_R, ymax: data_max});
};

SIR.plot = function(plot_id, ctrl_id, param_vals) {
    var plot = {};

    plot.svg = d3.select(plot_id).append('svg');

    var svg_rect = plot.svg.node().getBoundingClientRect();
    var margin_line;
    plot.width = svg_rect.width;
    plot.height = svg_rect.height;
    plot.margin = {
        top: 10,
        right: 20,
        bottom: 30,
        left: 80
    };
    plot.axis_width = 2;

    plot.ctrls = d3.select(ctrl_id);

    plot.params = {};
    plot.params.popn = 100000;
    plot.params.susc_frac = 1.0;
    plot.params.lockdown = 40;
    plot.params.R0 = 1.4;
    plot.params.lat_durn = 0.5;
    plot.params.inf_durn = 2.0;
    plot.params.res_durn = 365;
    plot.params.eta = 1.0;
    plot.params.n_days = 365;
    plot.params.y_max = 100;

    if (param_vals === undefined) {
        param_vals = {};
    }

    // Set parameters to initial form values.
    var set_param = function(update_plot) {
        return(function() {
            if (this.id in plot.params) {
                if (this.type === "range") {
                    if (this.min === this.max) {
                        if (this.id in param_vals) {
                            var values = param_vals[this.id];
                            this.min = 0;
                            this.max = values.length - 1;
                            this.step = 1;
                            this.data = values;
                            // Pick the default initial value, if specified.
                            var def = values.findIndex(function(v) { return v.default; });
                            if (def >= 0) {
                                this.value = def;
                            }
                        } else {
                            console.log("No values to initialise '%s'",
                                        this.id);
                            return;
                        }
                    }
                    var ix = parseInt(this.value);
                    // Update the parameter value.
                    plot.params[this.id] = this.data[ix].value;
                    // Display the parameter value.
                    var parent = d3.select(this.parentNode);
                    var label = parent.select(".show_value")[0][0];
                    if (this.data[ix].label !== undefined) {
                        label.textContent = this.data[ix].label;
                    } else {
                        label.textContent = this.data[ix].value;
                    }
                } else {
                    plot.params[this.id] = parseFloat(this.value);
                }
                if (update_plot) {
                    plot.update();
                }
            } else {
                console.log("Form control for unknown parameter '%s'",
                            this.id);
            }
        });
    };

    plot.ctrls.selectAll('select').each(set_param(false));
    plot.ctrls.selectAll('input').each(set_param(false));

    plot.draw_line = d3.svg.line()
        .x(function(d) {
            return plot.x_range(d.x);
        })
        .y(function(d) {
            return plot.y_range(d.y);
        })
        .interpolate('linear');

    plot.update = function() {
        var output = SIR.solve(
            plot.params.popn,
            plot.params.susc_frac,
            plot.params.lockdown,
            plot.params.R0,
            plot.params.lat_durn,
            plot.params.inf_durn,
            plot.params.res_durn,
            plot.params.eta,
            plot.params.n_days);

        if (plot.x_range === undefined) {
            plot.x_range = d3.scale.linear();
        }
        plot.x_range
            .range([plot.margin.left, plot.width - plot.margin.right])
            .domain([0, plot.params.n_days]);
        if (plot.y_range === undefined) {
            plot.y_range = d3.scale.linear();
        }
        plot.y_range
            .range([plot.height - plot.margin.bottom, plot.margin.top])
            .domain([0, plot.params.y_max]);
        if (plot.x_axis === undefined) {
            plot.x_axis = d3.svg.axis();
        }
        plot.x_axis
            .scale(plot.x_range)
            .ticks(10)
            .tickSize(0);
        if (plot.y_axis === undefined) {
            plot.y_axis = d3.svg.axis();
        }
        plot.y_axis
            .scale(plot.y_range)
            .orient('left')
            .tickSize(0)
            .tickFormat(function(d) { return d + "%"; })
            .ticks(4);

        // (Re)draw axes.
        if (plot.x_line === undefined) {
            plot.x_line = plot.svg.append('svg:line')
                .attr('class', 'x axis')
                .attr('stroke-width', plot.axis_width);
        }
        plot.x_line
            .attr("x1", plot.x_range(0) - plot.axis_width)
            .attr("y1", plot.y_range(0) + plot.axis_width)
            .attr("x2", plot.x_range(plot.params.n_days))
            .attr("y2", plot.y_range(0) + plot.axis_width);
        if (plot.x_ticks === undefined) {
            plot.x_ticks = plot.svg.append('svg:g')
                .attr('class', 'x tick');
        }
        plot.x_ticks
            .attr('transform', 'translate(0,' +
                  (plot.height - 0.5 * plot.margin.bottom) + ')')
            .call(plot.x_axis);
        if (plot.y_line === undefined) {
            plot.y_line = plot.svg.append('svg:line')
                .attr('class', 'y axis')
                .attr('stroke-width', plot.axis_width);
        }
        plot.y_line
            .attr("x1", plot.x_range(0) - plot.axis_width)
            .attr("y1", plot.y_range(0) + plot.axis_width)
            .attr("x2", plot.x_range(0) - plot.axis_width)
            .attr("y2", plot.y_range(plot.params.y_max));
        if (plot.y_ticks === undefined) {
            plot.y_ticks = plot.svg.append('svg:g')
                .attr('class', 'y tick');
        }
        plot.y_ticks
            .attr('transform', 'translate(' + (0.7 * plot.margin.left) + ',0)')
            .call(plot.y_axis);

        // Remove existing data series.
        plot.svg.selectAll('path.series').remove();
        plot.svg.selectAll(".lockdown").remove();
        margin_line = plot.x_range(plot.params.lockdown);

        plot.svg.append("line")
            .attr("x1", margin_line)  
            .attr("y1", plot.margin.top)
            .attr("x2", margin_line)  
            .attr("y2", plot.height - plot.margin.bottom)
            .attr("class", "lockdown")
            .style("stroke-width", 1)
            .style("stroke", "black")
            .style("fill", "none");

        plot.svg.append('svg:path')
            .attr('d', plot.draw_line(output.s))
            .attr('class', 'varS series');
        plot.svg.append('svg:path')
            .attr('d', plot.draw_line(output.e))
            .attr('class', 'varE series');
        plot.svg.append('svg:path')
            .attr('d', plot.draw_line(output.i))
            .attr('class', 'varI series');
        plot.svg.append('svg:path')
            .attr('d', plot.draw_line(output.r))
            .attr('class', 'varR series');
    };

    // Add update handlers for each input element.
    plot.ctrls.selectAll('select').on("change.param_val", set_param(true));
    plot.ctrls.selectAll('input').on("change.param_val", set_param(true));
    plot.ctrls.selectAll('input').on("input.param_val", set_param(true));

    d3.select(window).on('resize', function() {
        var svg_rect = plot.svg.node().getBoundingClientRect();
        plot.width = svg_rect.width;
        plot.height = svg_rect.height;
        plot.update();
    });

    plot.update();
};
