var probnic = require('../src/probe.js');

var progressLog = $('#progress-log');

function renderProgress(lbt, lb) {
    progressLog.text(progressLog.text() + lbt + "DONE" + JSON.stringify(lb) + '\n');
    debugger;
}

var t = new probnic.FtlProbeImpl("http://localhost:3000/probnic/recipe", renderProgress);
t.start();