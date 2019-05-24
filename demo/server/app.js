var express = require("express");
var app = express();
var cors = require('cors');
app.use(cors(
    {
        origin: 'http://localhost:8000',
        credentials: true,
    }
));

const crypto = require('crypto');
app.listen(3000, () => {
 console.log("Server running on port 3000");
});

app.get("/probnic/recipe", (req, res, next) => {
    return res.json({
        "next": 0,
        "pulse_timeout": 15000,
        "pulse_delays": [0, 2000, 2000],
        "urls": [
            {
                "name": "fast",
                "url": "http://localhost:3000/datagen/fast?size=5120"
            }
        ],
        "pulses": 3,
        "pulse_delay": 2000,
        "logblob": "test",
        "ctx": {
            "iter": null,
            "ts": 1558650825814
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