"use strict";

/*
Usage example:

var t = new FtlProbeImpl("https://www.netflix.com/api/ftl/probe?force=true", function (lbt, lb) { console.log(lbt, lb); });
t.start();
*/

export type LogBlobberFunc = (lbType: string, report: FTLProbeReport) => void;

export interface FtlProbe {
    start(): void;
    stop(): void;
}

export interface FTLProbeReport {
    readonly ctx: FTLProbeContext;
    readonly data: FTLProbeReportUnit[];
}

interface FTLProbeContext {
    [key: string]: string | number;
}

interface FTLProbeReportUnit {
    readonly name: string;
    readonly url: string;
    readonly data: FTLProbeReportPulse[];
}

interface FTLProbeReportPulse {
    readonly d: number;
    readonly ttfb: number | undefined;
    readonly dns: number | undefined;
    readonly tcp: number | undefined;
    readonly tls: number | undefined;
    readonly sz: number;
    readonly sc: number;
    readonly via: string;
}

interface FTLTestParameters {
    readonly next: number;
    readonly pulses: number;
    readonly pulse_delay: number;
    readonly pulse_timeout: number;
    readonly logblob: string;
    readonly ctx: FTLProbeContext;
    readonly urls: FTLProbeURLInfo[];
}

interface FTLProbeURLInfo {
    readonly name: string;
    readonly url: string;
}

export interface XhrFactory {
    create(): XMLHttpRequest;
}

interface HttpGetCallback {
    (status: number, headers: HttpHeaders, body: string | null, metrics: HttpMetrics): void;
}

interface HttpHeaders {
    [name: string]: string;
}

interface HttpMetrics {
    size: number;
    duration: number;
    ttfb: number;
    dns?: number;
    tcp?: number;
    tls?: number;
}

export interface Job {
    cancel(): void;
}

export interface Scheduler {
    scheduleAfter(delayMilliseconds: number, task: Function): Job;
}

export class FtlProbeImpl implements FtlProbe {
    public static xhrFactory: XhrFactory;
    public static httpGet: (url: string, withCookies: boolean, timeout: number, cb: HttpGetCallback) => void;
    public static scheduler: Scheduler;

    private iteration: number;
    private nextJob?: Job;
    private completed: boolean;

    /**
     * @param apiEndpoint The URL to the FTL test API endpoint (i.e.: https://api-global.netflix.com/ftl/probe)
     * @param logBlogger A function that send its second argument to logblob using the logblob type defined as first argument.
     */
    constructor(private apiEndpoint: string, private logBlobber: LogBlobberFunc) {
        this.iteration = 0;
        this.completed = false;
        const delimiter = this.apiEndpoint.indexOf('?') === -1 ? '?' : '&';
        const monotonic = window.performance && window.performance.now ? 'true' : 'false';
        this.apiEndpoint = `${this.apiEndpoint}${delimiter}monotonic=${monotonic}`;
    }

    /**
     * Start/resume the FTLTester engine
     */
    public start(): void {
        if (this.nextJob) {
            // Already started
            return;
        }
        if (this.completed) {
            // The test session is completed
            return;
        }
        this.nextJob = FtlProbeImpl.scheduler.scheduleAfter(0, this.run.bind(this));
    }

    /**
     * Interrupts the FTLTester engine
     */
    public stop(): void {
        if (this.nextJob) {
            this.nextJob.cancel();
            this.nextJob = undefined;
        }    
    }

    private run(): void {
        const endpoint = `${this.apiEndpoint}&iter=${this.iteration}`;
        getTestParams(endpoint, this.executeTest.bind(this));
    }

    private executeTest(params: FTLTestParameters | null): void {
        if (!params) {
            // Invalid test config, abandon the test alltogether
            this.stop();
            return;
        }
        const test = new FtlTest(params.urls, params.pulses, params.pulse_delay, params.pulse_timeout);
        test.run(this.handleResult.bind(this, params.logblob, params.ctx, params.next));
    }

    private handleResult(lbType: string, ctx: FTLProbeContext, next: number, reports: FTLProbeReportUnit[]): void {
        // Use the injected logger to log report
        this.logBlobber(lbType, {
            ctx: ctx,
            data: reports
        });
        
        // Schedule next round if necessary
        if (!this.nextJob) {
            // Tester is stopped
            return;
        }
        if (next > 0) {
            this.nextJob = FtlProbeImpl.scheduler.scheduleAfter(next, this.run.bind(this));
        } else {
            this.completed = true;
            this.stop();
        }
    }

}

class FtlTest {
    constructor(
        private urls: FTLProbeURLInfo[],
        private pulses: number,
        private pulse_delay: number,
        private pulse_timeout: number) {
    }

    private forEachURL(fn: (this: FtlTest, url: string, name: string) => void): void {
        for (let i = 0, l = this.urls.length; i < l; i++) {
            const info = this.urls[i];
            fn.bind(this)(info['url'], info['name']);
        }
    }

    public run(cb: (reports: FTLProbeReportUnit[]) => void) {
        const reports: FTLProbeReportUnit[] = [];
        const wg = new WaitGroup(this.urls.length);
        this.forEachURL(function (url, name) {
            const pulses: FTLProbeReportPulse[] = [];
            const handler = function (done: () => void, status: number, headers: HttpHeaders, metrics: HttpMetrics) {
                pulses.push({
                    'd': metrics.duration,
                    'ttfb': metrics.ttfb,
                    'dns': metrics.dns,
                    'tcp': metrics.tcp,
                    'tls': metrics.tls,
                    'sc': status,
                    'sz': metrics.size,
                    'via': headers['via']
                });
                done();
            }
            let nested = function finish() {
                reports.push({
                    'name': name,
                    'url': url,
                    'data': pulses
                });
                wg.done();
            }
            for (let i = this.pulses - 1; i >= 0; i--) {
                const pulse_timeout = this.pulse_timeout;
                nested = (function probe(next: () => void, delay: number) {
                    const task = probeURL.bind(null, url, pulse_timeout, handler.bind(null, next));
                    FtlProbeImpl.scheduler.scheduleAfter(delay, task);
                }).bind(null, nested, i > 0 ? this.pulse_delay : 0);
            }
            // Unwrap timeout(0), probe, timeout(delay), probe, timeout(delay), probe, finish
            nested();
        });
        wg.wait(function () {
            cb(reports);
        });
    }
}

class WaitGroup {
    private cb?: () => void;
    
    constructor(private total: number) {
    }

    public done(): void {
        this.total--;
        if (this.total === 0 && this.cb) {
            this.cb();
            this.cb = undefined;
        }
    }

    public wait(cb: () => void): void {
        if (this.total === 0) {
            cb();
        } else {
            this.cb = cb;
        }
    }
};

function isObject(o: any): boolean {
    return !!(o && ("object" === typeof o));
}

function isArray(a: any): boolean {
    return Object.prototype.toString.call(a) === '[object Array]';
}

function isInt(v: any): boolean {
  return !isNaN(v) && (function(x) { return (x | 0) === x; })(parseFloat(v))
}

function isString(v: any): boolean {
    return typeof v === 'string';
}

function getTestParams(apiEndpoint: string, cb: (params: FTLTestParameters | null) => void) {
    FtlProbeImpl.httpGet(apiEndpoint, true, 0, function (status, headers, body, metrics) {
        if (status != 200 || body == null) {
            cb(null);
            return;
        }
        try {
            const json = JSON.parse(body);
            const errPrefix = 'FTLTester: param';
            if (!isObject(json)) {
                throw new Error(`${errPrefix}: not an object`);
            }
            if (!isInt(json.next)) {
                throw new Error(`${errPrefix}.next: not an integer`);
            }
            if (!isInt(json.pulses)) {
                throw new Error(`${errPrefix}.pulses: not an integer`);
            }
            if (!isInt(json.pulse_delay)) {
                throw new Error(`${errPrefix}.pulse_delay: not an integer`);
            }
            if (!isInt(json.pulse_timeout)) {
                throw new Error(`${errPrefix}.pulse_timeout: not an integer`);
            }
            if (!isString(json.logblob)) {
                throw new Error(`${errPrefix}.logblob: not a string`);
            }
            if (!isObject(json.ctx)) {
                throw new Error(`${errPrefix}.ctx: not an object`);
            }
            if (!isArray(json.urls)) {
                throw new Error(`${errPrefix}.urls: not an array`);
            }
            for (let i = 0, l = json.urls.length; i < l; i++) {
                const urlInfo = json.urls[i];
                if (!isObject(urlInfo)) {
                    throw new Error(`${errPrefix}.urls[${i}]: not an object`);
                }
                if (!isString(urlInfo.name)) {
                    throw new Error(`${errPrefix}.urls[${i}].name: not a string`);
                }
                if (!isString(urlInfo.url)) {
                    throw new Error(`${errPrefix}.urls[${i}].url: not a string`);
                }
            }
            const params = <FTLTestParameters>json;
            cb(params);
        } catch (e) {
            if (console && console.error) {
                console.error(e);
            }
            cb(null);
            return;
        }
    });
}

function probeURL(url: string, timeout: number, cb: (status: number, headers: HttpHeaders, metrics: HttpMetrics) => void) {
    FtlProbeImpl.httpGet(url, false, timeout, function (status, headers, body, metrics) {
        cb(status, headers, metrics);
    })
}

class XhrFactoryImpl implements XhrFactory {
    public create(): XMLHttpRequest {
        return new XMLHttpRequest();
    }
}

FtlProbeImpl.xhrFactory = new XhrFactoryImpl();

function now(): number {
    if (window.performance && window.performance.now) {
        // Use monotonic clock when available
        return performance.now();
    }
    return new Date().getTime();
}

// Provide default implementation of httpGet. Override to use non XHR fetching method.
FtlProbeImpl.httpGet = function httpGet(url: string, withCookies: boolean, timeout: number, cb: HttpGetCallback): void {
    let req: XMLHttpRequest;
    try {
        req = FtlProbeImpl.xhrFactory.create();
    } catch (e) {
        cb(0, {}, null, getMetrics(null, 0, 0, 0));
        return;
    }
    if (!('withCredentials' in req)) {
        // Missing CORS support
        cb(0, {}, null, getMetrics(null, 0, 0, 0));
        return;
    }
    if (withCookies) {
        req.withCredentials = true;
    }
    if (timeout) {
        req.timeout = timeout;
    }
    const t = now();
    let ttfb = 0;
    req.open('GET', url, true);
    req.onreadystatechange = function () {
        switch (req.readyState) {
            case 2:
                ttfb = now() - t;
                break;
            case 4:
                let headers = {};
                if ('getAllResponseHeaders' in req) {
                    headers = parseHeaders(req.getAllResponseHeaders());
                }
                const body = req.responseText;
                let length = body.length;
                if (req.response) {
                    length = req.response.length;
                }
                const duration = now() - t;
                const metrics = getMetrics(url, length, duration, ttfb);
                cb(req.status, headers, body, metrics);
                break;
        }
    };
    req.send();
};

// Build HttpMetrics with calculated metrics or performance API metrics if available.
function getMetrics(url: string | null, size: number, duration: number, ttfb: number): HttpMetrics {
    const metrics: HttpMetrics = {
        size: size,
        duration: duration,
        ttfb: ttfb
    };
    if (!url || !window.performance || !window.performance.getEntriesByName) {
        return metrics;
    }
    let entries = window.performance.getEntriesByName(url);
    if (entries.length == 0) {
        // In the case the URL does not have a path (i.e.: http://domain.com), the browser
        // adds a trailing slash and thus the entry might not match. Try again by adding the
        // slash by ourself.
        entries = window.performance.getEntriesByName(url + '/');
        if (entries.length == 0) {
            return metrics;
        }
    }
    const timing = entries[entries.length - 1] as PerformanceResourceTiming;
    if ('decodedBodySize' in timing) {
        metrics.size = timing.decodedBodySize;
    }
    if (timing.duration) {
        metrics.duration = timing.duration;
    } else if (timing.startTime && timing.responseEnd) {
        metrics.duration = timing.responseEnd - timing.startTime;
    }
    if (timing.requestStart) {
        metrics.dns = timing.domainLookupEnd - timing.domainLookupStart;
        metrics.ttfb = timing.responseStart - timing.startTime;
        metrics.tcp = timing.connectEnd - timing.connectStart;
        // secureConnectionStart can be 0 instead of timestamp when connection is reused
        if (timing.secureConnectionStart === 0) {
            // Chrome has a known bug setting the secureConnectionStart to 0 when the
            // TLS connection is reused. The spec says that 0 should be used when TLS
            // is not used. FTL probes are always HTTPS to avoid mixed content issue,
            // so it is safe to assume that 0 means reused and not HTTP.
            metrics.tls = 0;
        } else if (timing.secureConnectionStart !== undefined) {
            metrics.tls = timing.connectEnd - timing.secureConnectionStart;
            // The TCP metric must not include the TLS handshake (we want to
            // approximate the TCP handshake time).
            metrics.tcp -= metrics.tls;
        }
    }
    return metrics;
}

function parseHeaders(headerStr: string): HttpHeaders {
  const headers: HttpHeaders = {};
  if (!headerStr) {
    return headers;
  }
  const headerPairs = headerStr.split('\u000d\u000a');
  for (let i = 0; i < headerPairs.length; i++) {
    const headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    const index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      const key = headerPair.substring(0, index).toLowerCase();
      const val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

class SchedulerImpl implements Scheduler {
    public scheduleAfter(delayMilliseconds: number, task: Function): Job {
        let id = setTimeout(task, delayMilliseconds);
        return { cancel: function() { clearTimeout(id) } };
    }
}

FtlProbeImpl.scheduler = new SchedulerImpl();
