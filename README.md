Get a taste of netwrok with Probnic
============================

Probnic is a simple but powerful measurement framework, allowing you to compare various alternatives for you network configuration. It is easy to integrate into your application code, performs tests in the background, sending a summary for analysis upon completion.


Components
============================
For practical application operation of Probnic consists of 4 main components:
* A list of targets (e.g. HTTP endpoints) that are being tested and compared
* A provider of test recipe, identifying list of targets to test
* A client agent, which performs tests against given targets and collects measurements
* A reporting and analytics system

Please see [TODO: link] detailed documentation about Probnic.

Quick Start
============================

As measurement goals and measured targets would differ, this repository provides an implementation of a client agent and defines basic interfaces to get test recipe and send results. For practical usage defining and setting up test targets, recipe provider and analytics system is up to a user.

One of the typical scenarios for probnic is comparing network latency or availability characteristics of different endpoints for your customers (e.g. different datacenters). 

The setup would consist of 3 steps:
1. Set up HTTP endpoint(s) to respond to HTTP GET requests on your servers, e.g.:

```
HTTP GET https://dc1.myapi.com/data?size=5000

> HTTP 200 on success, 5KB payload
```

2.  Set up another HTTP endpoint to provide a recipe to test, listing available choices:

```
HTTP GET https://myapi.com/recipe

HTTP 200, JSON
{
    "next": 0,
    "pulse_timeout": 15000,
    "pulse_delays": [ 0, 2000, 2000 ],
    "targets": [{
            "name": "Datacenter 1",
            "target": "https://dc1.myapi.com/data?size=5000"
        }, {
            "name": "Datacenter 2",
            "target": "https://dc2.myapi.com/data?size=5000"
        }],
    "pulses": 3,
    "pulse_delay": 2000,
    "name": "My Test Recipe",
    "ctx": {
        "ts": 1558997335285
    }
}
```

**Note:** setting up a working HTTP endpoint to provide a Probnic recipe is optional. An alternative is to send a static configuration with your application. However, we recommend setting up an endpoint, as it gives you the ability to control frequency of tests, as well as tests difference recipes in parallel.

3. Configure you application to run Probnic:
Include `probnic.js` in your application, then configure it to run as shown below:
```
    function onComplete(name, report) {
        console.log("Probe ${name} report: " + JSON.stringify(report));
    }

    var recipeProvider = new probnic.RestRecipeProvider("https://myapi.com/recipe"),
        p = new probnic.BrowserProbnic(recipeProvider, onComplete);
    p.start();
```

You can refer to a demo in this repo for an example of such setup.

Features and Use Cases
============================
Being a lightweight and flexible component, Probnic provides a wide range of use cases.

Today it is being used at Netflix to:
* Identify connectivity issues and faster network paths for client traffic
* Build availability metrics for your infrastructure
* Compare DNS providers
* Compare TLS ciphers and config
* Measure impact of various protocols (e.g. HTTP 1.1 vs HTTP2)
* Build a volume/latency models of client traffic
* And more...

Demo 
============================
This repo includes a simple demo application, showing one of the ways to integrate with Probnic and analyze the results.

## Prerequisites
Make sure that `npm` and `Node` are installed.
Probnic and demo target ES5, so should be supported on all modern browsers.

## Installation

Install npm dependencies for the project.

```
npm install
```

## Running demo
```
npm run demo
```

Open the broser at `http://localhost:8000`. The demo also runs a webserver on `localhost:3000` to provide Probnic recipes and target endpoints.

Documentation and more info
============================
Link to a Wiki

Contributing
============================
Bug reports, feature requests and especially pull requests (fixing bugs or adding features) are welcome!

To ensure effective interactions, please follow a 'Contibuting to Probnic' guide.

License
============================
License info