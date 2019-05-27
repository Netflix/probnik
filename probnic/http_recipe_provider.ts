import { RecipeProvider, ProbeRecipe } from './probnic';
import { HttpRequester } from './requester';
import { XhrHttpRequester } from './xhr_requester';

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

 /**
 * Provides Probnic recipe based on an output of a REST HTTP endpoint.
 * When acked to provide a recipe, performs an HTTP GET call on a configured URL and provides
 * the result back to the caller.
 */
export class RestRecipeProvider implements RecipeProvider {
    /** Requester used to get data */
    public static requester: HttpRequester;

    /**
     * @param url URL of an API endpoint to call to get a recipe.
     */
    constructor(private url: string) {
    }

    /** Provides recipe to test. */
    public getRecipe(cb: (params: ProbeRecipe | null) => void): void {
        RestRecipeProvider.requester.get(this.url, true, 0, function (status, headers, body, metrics) {
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
                const params = <ProbeRecipe>json;
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
}

RestRecipeProvider.requester = new XhrHttpRequester();