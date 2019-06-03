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

/**
 * Implements XHR requester to run Probe and get ProbeRecipe
 */

import { Requester, RequesterCallback, RequesterOptions } from '../probe';

/**
 * A data object that contains HTTP metrics report.
 */
export interface HttpProbePulseSampleReport {
    /** Pulse start. */
    start: number;
    /** Request duration. Pulse end is start + d. */
    d: number;
    /** Status code of the request. */
    sc: number;
    /** Payload size */
    size: number;
    /** Time to First Byte. */
    ttfb: number;
    /** DNS time. */
    dns?: number;
    /** TCP time. */
    tcp?: number;
    /** TLS time. */
    tls?: number;
    /** Via HTTP header */
    via?: string;
    /** Extra information associated with the response. */
    [key: string]: string | number | undefined;
}

/**
 * HTTP headers
 */
interface HttpHeaders {
    [name: string]: string;
}

/**
 * Represents HTTP response.
 */
export interface HttpGetData {
    readonly body: string | null;
    readonly status: number;
    readonly headers: Readonly<HttpHeaders>;
}

/**
 * Callback to receive result of an HTTP call.
 */
export interface HttpGetDataCallback {
    (status: number, headers: HttpHeaders, body: string | null): void;
}

function getXhr(): XMLHttpRequest {
    return new XMLHttpRequest();
}

function now(): number {
    if (window.performance && window.performance.now) {
        // Use monotonic clock when available
        return performance.now();
    }
    return new Date().getTime();
}

// Build HttpMetrics with calculated metrics or performance API metrics if available.
function getReport(url: string | null, size: number, start: number, duration: number, ttfb: number, headers?: HttpHeaders): HttpProbePulseSampleReport {
    const report: HttpProbePulseSampleReport = {
        start: start,
        size: size,
        d: duration,
        ttfb: ttfb,
        sc: 0
    };
    if (headers) {
        report.via = headers.via;
    }
    if (!url || !window.performance || !window.performance.getEntriesByName) {
        return report;
    }
    let entries = window.performance.getEntriesByName(url);
    if (entries.length == 0) {
        // In the case the URL does not have a path (i.e.: http://domain.com), the browser
        // adds a trailing slash and thus the entry might not match. Try again by adding the
        // slash by ourself.
        entries = window.performance.getEntriesByName(url + '/');
        if (entries.length == 0) {
            return report;
        }
    }
    const timing = entries[entries.length - 1] as PerformanceResourceTiming;
    if ('decodedBodySize' in timing) {
        report.size = timing.decodedBodySize;
    }
    if (timing.duration) {
        report.d = timing.duration;
    } else if (timing.startTime && timing.responseEnd) {
        report.d = timing.responseEnd - timing.startTime;
    }
    if (timing.requestStart) {
        report.dns = timing.domainLookupEnd - timing.domainLookupStart;
        report.ttfb = timing.responseStart - timing.startTime;
        report.tcp = timing.connectEnd - timing.connectStart;
        // secureConnectionStart can be 0 instead of timestamp when connection is reused
        if (timing.secureConnectionStart === 0) {
            // Chrome has a known bug setting the secureConnectionStart to 0 when the
            // TLS connection is reused. The spec says that 0 should be used when TLS
            // is not used. Probes are always HTTPS to avoid mixed content issue,
            // so it is safe to assume that 0 means reused and not HTTP.
            report.tls = 0;
        } else if (timing.secureConnectionStart !== undefined) {
            report.tls = timing.connectEnd - timing.secureConnectionStart;
            // The TCP metric must not include the TLS handshake (we want to
            // approximate the TCP handshake time).
            report.tcp -= report.tls;
        }
    }
    return report;
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

/**
 * Runs HTTP Probe tests using XHR object.
 */
export class XhrHttpRequester implements Requester {
    
    public get(url: string, timeout: number, cb: RequesterCallback, options: RequesterOptions): void {
        let req: XMLHttpRequest;
        try {
            req = getXhr();
        } catch (e) {
            cb(getReport(url, 0, 0, 0, 0));
            return;
        }
        if (!('withCredentials' in req)) {
            // Missing CORS support
            cb(getReport(url, 0, 0, 0, 0));
            return;
        }
        if (options.withCookies) {
            req.withCredentials = true;
        }
        if (timeout) {
            req.timeout = timeout;
        }
        const start = now();
        let ttfb = 0;
        req.open('GET', url, true);
        req.onreadystatechange = function () {
            switch (req.readyState) {
                case 2:
                    ttfb = now() - start;
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
                    const duration = now() - start;
                    cb(getReport(url, length, start, duration, ttfb, headers));
                    break;
            }
        };
        req.send();
    }

    public getData(url: string, timeout: number, cb: HttpGetDataCallback, options: RequesterOptions): void {
        let req: XMLHttpRequest;
        try {
            req = getXhr();
        } catch (e) {
            cb(0, {}, null)
            return;
        }
        if (!('withCredentials' in req)) {
            // Missing CORS support
            cb(0, {}, null)
            return;
        }
        if (options.withCookies) {
            req.withCredentials = true;
        }
        if (timeout) {
            req.timeout = timeout;
        }
        const start = now();
        req.open('GET', url, true);
        req.onreadystatechange = function () {
            switch (req.readyState) {
                case 4:
                    let headers = {};
                    if ('getAllResponseHeaders' in req) {
                        headers = parseHeaders(req.getAllResponseHeaders());
                    }
                    const body = req.responseText;
                    if (req.response) {
                        length = req.response.length;
                    }
                    cb(req.status, headers, body);
                    break;
            }
        };
        req.send();
    }
}