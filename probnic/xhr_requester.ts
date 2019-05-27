import { HttpRequester, HttpGetCallback, HttpMetrics, HttpHeaders } from './requester';

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

export class XhrHttpRequester implements HttpRequester {
    public get(url: string, withCookies: boolean, timeout: number, cb: HttpGetCallback): void {
        let req: XMLHttpRequest;
        try {
            req = getXhr();
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
    }
}