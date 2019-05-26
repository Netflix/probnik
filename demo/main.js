var probnic = require('../src/probe.js');

var progressLog = $('#progress-log');

var results = [];
var bucketProbes = {}; // map between bucket on xAxis on graph and array of probe samples for this bucket.

var charts = [
    { 
        chart: new Chart(document.getElementById("probe-rps-chart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Time",
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                        stacked: true,
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "RPS",
                        }
                    }]
                }
            }
        }),
        computeValue: function(values) {
            // TODO: change pulse to a configurable param
            var pulse = 0;
            return d3.rollup(values, v => v.length, d => d.name);
        }
    }, {
        chart: new Chart(document.getElementById("errors-rate-chart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Time",
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Errors Rate (%)",
                        }
                    }]
                }
            }
        }),
        computeValue: function(values) {
            function errorsCount(samples) {
                // TODO: change pulse to a configurable param
                var errors = 0,
                    pulse = 0;
                samples.forEach(function(v) {
                    if (v.data[pulse].sc !== 200) {
                        errors += 1;
                    }
                });
                return errors;
            }

            return d3.rollup(values, v => errorsCount(v) * 100 / v.length, d => d.name);
        }
    }, {
        chart: new Chart(document.getElementById("probe-share-chart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Time",
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                        stacked: true,
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Probe Share",
                        }
                    }]
                }
            }
        }),
        computeValue: function(values) {
            // TODO: change pulse to a configurable param
            var pulse = 0,
                total = values.length;
            return d3.rollup(values, v => v.length * 100 / total, d => d.name);
        }
    }, {
        chart: new Chart(document.getElementById("errors-share-chart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Time",
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                        stacked: true,
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Errors Share",
                        }
                    }]
                }
            }
        }),
        computeValue: function(values) {
            function errorsCount(samples) {
                // TODO: change pulse to a configurable param
                var errors = 0,
                    pulse = 0;
                samples.forEach(function(v) {
                    if (v.data[pulse].sc !== 200) {
                        errors += 1;
                    }
                });
                return errors;
            }

            var total = errorsCount(values);
            if (total === 0) {
                total = 1;
            }

            return d3.rollup(values, v => errorsCount(v) * 100 / total, d => d.name);
        }
    }, {
        chart: new Chart(document.getElementById("timing-chart"), {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                scales: {
                    xAxes: [{
                        type: 'time',
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Time",
                        }
                    }],
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                        },
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: "Median Time",
                        }
                    }]
                }
            }
        }),
        computeValue: function(values) {
            function computePercentile(samples) {
                // TODO: change pulse to a configurable param
                // TODO: change percentile to a configurable param
                var percentile = 0.5,
                    pulse = 0;
                return d3.quantile(samples.map(s => s.data[pulse].d), percentile); 
            }

            return d3.rollup(values, v => computePercentile(v), d => d.name);
        }
    }];


function dateBucket(seconds, ts) {
    let ms = 1000 * seconds; // convert minutes to ms
    return Math.round(ts / ms) * ms;
}

function graphOnComplete(probe) {
    // define a bucket for the completed probe
    // TODO: parametrize with a bucket
    var bucket = dateBucket(5, probe.ctx.ts),
        maxBuckets = 50, // TODO: parametrize
        newBucket = false;

    // check if new bucket needs to be created for graphs
    if (!bucketProbes[bucket]) {
        newBucket = true;
        bucketProbes[bucket] = [];
    }

    probe.data.forEach(function(sample) {
        bucketProbes[bucket].push(sample);
    });

    charts.forEach(function(c) {
        var chart = c.chart;
        if (newBucket) {
            chart.data.labels.push(bucket);
        }

        if (chart.data.labels.length > maxBuckets) {
            var i;
            for (i = 0; i < chart.data.labels.length - maxBuckets; ++i) {
                chart.data.labels.shift();

                chart.data.datasets.forEach((dataset) => {
                    dataset.data.shift();
                });
            }
        }

        // update or add new point
        var values = c.computeValue(bucketProbes[bucket]);
        chart.data.datasets.forEach((dataset) => {
            var value = values.get(dataset.label);
            if (newBucket) {
                dataset.data.push(value);
             } else {
                dataset.data[dataset.data.length - 1] = value;
             }
             values.delete(dataset.label);
        });
        Array.from(values).forEach(v => { 
            chart.data.datasets.push({
                label: v[0], 
                data: [v[1]] // TODO: pad with 0 values to match other buckets
            });
        });
        chart.update();
    });
    /*
    // if yes - add new point
    // remove old points, if needed

    // if not - update last point

    // refresh graphs


    // transform probes so each target has a timestamp
    var extendedProbes = probes.map(v => v.data.map(function(d) { d.ts = v.ctx.ts; return d; })).flat();

    // convert set of probes for each bucket to a metric for each target
    var rolledUp = d3.rollups(extendedProbes, v => v.length, d => dateBucket(1, d.ts), d => d.name)

    var lastLabel = rolledUp[rolledUp.length - 1][0];

    var datasets = d3.groups(rolledUp.map(d => d[1]).flat(), d => d[0]).map(function(d) { return {label: d[0], data: d[1].map(d => d[1])}});
    var lastDataset = datasets[datasets.length - 1];

    if (lastLabel !== rpsChart.data.labels[rpsChart.data.labels.length - 1]) {
        rpsChart.data.labels.push(lastLabel);
        if (rpsChart.data.datasets.length === 0) {
            rpsChart.data.datasets = datasets;
        } else {
            var i = 0;
            rpsChart.data.datasets.forEach((dataset) => {
                dataset.data.push(datasets[i].data[datasets[i].data.length - 1]);
                i+=1;
            });
        }
    } else {
        var i = 0;
        rpsChart.data.datasets.forEach((dataset) => {
            dataset.data[dataset.data.length - 1] = datasets[i].data[datasets[i].data.length - 1];
            i+=1;
        });
    }
    rpsChart.update();*/
}

function onComplete(recipeName, data) {
    results.push(data);
    graphOnComplete(data);
    progressLog.text(progressLog.text() + recipeName + "DONE" + JSON.stringify(data) + '\n');
}

function runProbe() {
    var recipeUrl = "http://localhost:3000/probnic/recipe";
    var t = new probnic.FtlProbeImpl(recipeUrl, onComplete);
    t.start();
}

setInterval(runProbe, 1000); 
