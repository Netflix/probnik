var express = require("express");
var app = express();
var cors = require('cors');
app.use(cors(
    {
        origin: 'http://localhost:8000',
        credentials: true,
    }
));

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

const crypto = require('crypto');
app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/probnik/recipe/demo1", (req, res, next) => {
    var targets = [
        {
            "name": "fast",
            "target": "http://localhost:3000/datagen/fast?size=5120"
        },
        {
            "name": "slow",
            "target": "http://localhost:3000/datagen/slow?size=5120"
        },
        {
            "name": "wonky",
            "target": "http://localhost:3000/datagen/wonky?size=5120"
        }
    ];
    shuffleArray(targets);

    return res.json({
        "next": 0,
        "pulse_timeout": 15000,
        "targets": targets,
        "pulses": 3,
        "pulse_delay": 2000,
        "name": "Demo Test 1",
        "type": "http_get",
        "ctx": {
            "iter": null,
            "ts": new Date().valueOf()
        }
    });
   });

   app.get("/probnik/recipe/demo2", (req, res, next) => {
    var targets = [
        {
            "name": "small",
            "target": "http://localhost:3000/datagen/fast?size=1000"
        },
        {
            "name": "medium",
            "target": "http://localhost:3000/datagen/fast?size=5000"
        },
        {
            "name": "large",
            "target": "http://localhost:3000/datagen/fast?size=10000"
        }
    ];
    shuffleArray(targets);

    return res.json({
        "next": 0,
        "pulse_timeout": 15000,
        "targets": targets,
        "pulses": 3,
        "pulse_delay": 2000,
        "name": "Demo Test 2",
        "type": "http_get",
        "ctx": {
            "iter": null,
            "ts": new Date().valueOf()
        }
    });
   });

app.get("/datagen/fast", (req, res, next) => {
    const len = parseInt(req.query.size, 10) || 1000;
    const buf = crypto.randomBytes(len || 1000);
    res.writeHead(200, {
        'Content-Type': "application/x-binary",
        'Content-Length': len
    });
    res.end(buf, 'binary');
});

app.get("/datagen/slow", (req, res, next) => {
    const len = parseInt(req.query.size, 10) || 1000;
    const buf = crypto.randomBytes(len || 1000);

    res.writeHead(200, {
        'Content-Type': "application/x-binary",
        'Content-Length': len
    });
    sleep(10).then(() => {
        res.end(buf, 'binary');
    }); 
});

app.get("/datagen/wonky", (req, res, next) => {
    const len = parseInt(req.query.size, 10) || 1000;
    const buf = crypto.randomBytes(len || 1000);
    let sc = 200;
    if (Math.random() > 0.9) {
        sc = 503;
    }
    res.writeHead(sc, {
        'Content-Type': "application/x-binary",
        'Content-Length': len
    });
    res.end(buf, 'binary');
});