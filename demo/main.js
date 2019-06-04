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

import { RestRecipeProvider, BrowserProbe } from '../probnik/probnik.ts';

var charts = require('./charts.js').charts(
    $("#probe-rps-chart"), 
    $("#errors-rate-chart"),
    $("#probe-share-chart"),
    $("#errors-share-chart"),
    $("#timing-chart")
),
    table = require('./probe_log.js').probeLog($('#probes-log-table')),
    recipeProvider = new RestRecipeProvider("http://localhost:3000/probnik/recipe/demo1"),
    schedulerIsActive = true,
    startStopBtn = document.getElementById("scheduler-start-btn");

function onComplete(data) {
    charts.addProbe(data);
    table.addProbe(data);
}

function runProbe() {
    var rangeSlider = document.getElementById("scheduler-interval-range");
    if (schedulerIsActive) {
        var t = new BrowserProbe(recipeProvider, onComplete);
        t.start();
    }
    setTimeout(runProbe, rangeSlider.value);
}


function updateRecipe() {
    recipeProvider.getRecipe(0, function(recipeData) {
        $('#recipe-json').text(JSON.stringify(recipeData, '', 4));

        var targetsTableElem = $('#recipe-targets');
        targetsTableElem.empty();
        recipeData.targets.forEach(target => {
            targetsTableElem.append('<tr>' +
                '<td><strong>' + target.name + '</strong></td><td>' + target.target + '</td>' + 
            '</tr>'
            )
        });

        $('#recipe-pulse-timeout').text(recipeData.pulse_timeout);
        $('#recipe-pulse-delay').text(recipeData.pulse_delay);
    });
}

$("#scheduler-interval-range").change(function() {
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

function changeRecipeUrl(url) {
    recipeProvider = new RestRecipeProvider(url);
    updateRecipe();
    charts.reset();
    table.reset();
}

$('#recipe-url').change(function(event) {
    changeRecipeUrl(event.target.value);
})

$('.recipe-selector').click(function(event) {
    var url = $(event.target).attr('recipe-url');
    $('#recipe-url').val(url);
    changeRecipeUrl(url);
})
 
updateRecipe();
runProbe();

