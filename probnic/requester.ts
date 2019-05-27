/**
 * Contains public interfaces to get data for Probnic requests.
 */

export interface HttpHeaders {
    [name: string]: string;
}

export interface HttpGetCallback {
    (status: number, headers: HttpHeaders, body: string | null, metrics: HttpMetrics): void;
}

export interface HttpMetrics {
    size: number;
    duration: number;
    ttfb: number;
    dns?: number;
    tcp?: number;
    tls?: number;
}

export interface HttpGetResult {
    readonly body: string | null;
    readonly status: number;
    readonly headers: Readonly<HttpHeaders>;
    readonly metrics: Readonly<HttpMetrics>;
}

export interface HttpRequester {
    get(url: string, withCookies: boolean, timeout: number, cb: HttpGetCallback): void
}