var probnic = require('../probnic/probnic.ts');

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
}

function onComplete(recipeName, data) {
    results.push(data);
    graphOnComplete(data);

    table.row.add([results.length - 1, data.ctx.ts, recipeName, '']).draw();
}

function runProbe() {
    var rangeSlider = document.getElementById("scheduler-interval-range");
    if (schedulerIsActive) {
        var recipeProvider = new probnic.RestRecipeProvider("http://localhost:3000/probnic/recipe");
        var t = new probnic.BrowserProbe(recipeProvider, onComplete);
        t.start();
    }
    setTimeout(runProbe, rangeSlider.value);
}

var schedulerIsActive = true,
    startStopBtn = document.getElementById("scheduler-start-btn");

document.getElementById("scheduler-interval-range").addEventListener("change", function() {
    document.getElementById("scheduler-interval-value").value = this.value;
});


startStopBtn.addEventListener("click", function() {
    if (schedulerIsActive) {
        // stop the scheduler
        schedulerIsActive = false;
        startStopBtn.classList.add('btn-success');
        startStopBtn.classList.remove('btn-danger');
        startStopBtn.innerText = "Start";
    } else {
        // start the scheduler
        schedulerIsActive = true;
        startStopBtn.classList.add('btn-danger');
        startStopBtn.classList.remove('btn-success');
        startStopBtn.innerText = "Stop";   
    }
});

var table = $('#probes-log-table').DataTable({
    "columnDefs": [{
            // The `data` parameter refers to the data for the cell (defined by the
            // `data` option, which defaults to the column being worked with, in
            // this case `data: 0`.
            "render": function ( data, type, row ) {
                return '<button class="probe-details-btn">JSON</button>';
            },
            "targets": 3
        }],
    });

function formatSampleDetails(data) {
    var details = '<div class="container-fluid">' +
        '<table>'+
        '<thead>' + 
            '<th>Target</th>' + 
            '<th>URL</th>' + 
            '<th>Status</th>' + 
            '<th>Duration</th>' + 
        '</thead>' + 
        '<tbody>';
    data.data.forEach((sample) => {
        details += '<tr>'+
            '<td>' + sample.name + '</td>' +
            '<td>' + sample.target + '</td>' +
            '<td>' + sample.data[0].sc + '</td>' +
            '<td>' + sample.data[0].d + '</td>' +
        '</tr>';
    });
    details +='</tbody>'+ '</table> </div>';
    return details;
}

// Add event listener for opening and closing details
$('#probes-log-table tbody').on('click', 'td', function (event) {
    var tr = $(this).closest('tr');
    var row = table.row( tr );

    var probe = results[row.data()[0]];

    if ($(event.target).hasClass('probe-details-btn')) {
        document.getElementById('probe-json').innerText = JSON.stringify(probe, null, '  ');
        $('#probe-details-modal').modal('show');
    } else {
        if ( row.child.isShown() ) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            // Open this row
            row.child( formatSampleDetails(probe) ).show();
            tr.addClass('shown');
        }
    }
} );
 

runProbe();
