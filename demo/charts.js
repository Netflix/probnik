/**
 *
 *  Copyright 2019 Netflix, Inc.
 *
 *     Licensed under the Apache License, Version 2.0 (the "License");
 *     you may not use this file except in compliance with the License.
 *     You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 *
 */

export var charts = function charts(rpsElem, errorsRateElem, probeShareElem, errorShareElem, timeElem) {
    const palette = ["#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"];

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
            Array.from(values).forEach((v, i) => { 
                chart.data.datasets.push({
                    fill: chart.config.fill,
                    backgroundColor: chart.config.backgroundColor[i],
                    borderColor: chart.config.backgroundColor[i],
                    label: v[0], 
                    data: [v[1]] // TODO: pad with 0 values to match other buckets
                });
            });
            chart.update();
        });
    }

    var bucketProbes = {}; // map between bucket on xAxis on graph and array of probe samples for this bucket.
    var charts = [
        { 
            chart: new Chart(rpsElem, {
                type: 'line',
                fill: true,
                backgroundColor: palette,
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
                return d3.rollup(values, v => v.length, d => d.name);
            }
        }, {
            chart: new Chart(errorsRateElem, {
                type: 'line',
                fill: false,
                backgroundColor: palette,
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
                            stacked: false,
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
            chart: new Chart(probeShareElem, {
                type: 'line',
                fill: true,
                backgroundColor: palette,
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
            chart: new Chart(errorShareElem, {
                type: 'line',
                fill: true,
                backgroundColor: palette,
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
            chart: new Chart(timeElem, {
                type: 'line',
                fill: false,
                backgroundColor: palette,
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
                            stacked: false,
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


    return {
        addProbe: graphOnComplete,
        reset: function() {
            charts.forEach(function(c) {
                var chart = c.chart;
                chart.data.labels = [];
                chart.data.datasets = [];
                chart.update();
            });
        }
    }
};