import { RecipeProvider, ProbeRecipe, RequesterOptions } from './probe';
import { XhrHttpRequester, HttpGetData, HttpGetDataCallback } from './xhr_requester';

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

interface HttpDataRequester {
    getData(url: string, timeout: number, cb: HttpGetDataCallback, options: RequesterOptions): void
}

 /**
 * Provides Probnic recipe based on an output of a REST HTTP endpoint.
 * When acked to provide a recipe, performs an HTTP GET call on a configured URL and provides
 * the result back to the caller.
 */
export class RestRecipeProvider implements RecipeProvider {
    /** Requester used to get data */
    public static requester: HttpDataRequester;

    /**
     * @param url URL of an API endpoint to call to get a recipe.
     */
    constructor(private url: string) {
    }

    /** Provides recipe to test. */
    public getRecipe(iteration: number, cb: (params: ProbeRecipe | null) => void): void {
        let url = this.url 

        const delimiter = url.indexOf('?') === -1 ? '?' : '&';
        url = `${url}${delimiter}iteration=${iteration}`;
        RestRecipeProvider.requester.getData(url, 0, function (status, headers, body) {
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
                if (!isString(json.name)) {
                    throw new Error(`${errPrefix}.name: not a string`);
                }
                if (!isObject(json.ctx)) {
                    throw new Error(`${errPrefix}.ctx: not an object`);
                }
                if (!isArray(json.targets)) {
                    throw new Error(`${errPrefix}.targets: not an array`);
                }
                for (let i = 0, l = json.targets.length; i < l; i++) {
                    const targetInfo = json.targets[i];
                    if (!isObject(targetInfo)) {
                        throw new Error(`${errPrefix}.targets[${i}]: not an object`);
                    }
                    if (!isString(targetInfo.name)) {
                        throw new Error(`${errPrefix}.targets[${i}].name: not a string`);
                    }
                    if (!isString(targetInfo.target)) {
                        throw new Error(`${errPrefix}.targets[${i}].target: not a string`);
                    }
                }
                const params = <ProbeRecipe>json;
                cb(params);
            } catch (e) {
                if (console && console.error) {
                    console.error(e);
                }
                cb(null);
                return;
            }
        }, {withCookies: true});
    }
}

RestRecipeProvider.requester = new XhrHttpRequester();