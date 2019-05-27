/**
 * Contains public interfaces for the Probnic runtime.
 */

 /**
 * A component that executes a series of tests to compare performance of several alternatives for network requests.
 */
export interface Probnic {
    /** An object that provides a recipe to executes tests. */
    recipeProvider: RecipeProvider

    /** An object that receives results of probe runs. */
    reporter: ProbeReporter

    /** Start/resume execution of the test. */
    start(): void;

    /** Stops execution of the test. */
    stop(): void;
}

/**
 * Receives Probe results from a Probnic object. 
 * 
 * This is a way to collect results for Probnic tests to act upon. 
 */
export type ProbeReporter = (recipeName: string, report: ProbeReport) => void;

 /**
 * Provides probe recipe for Probnic to test.
 */
export interface RecipeProvider {
    /** Provides recipe to test. */
    getRecipe(cb: (params: ProbeRecipe | null) => void): void;
}

 /**
 * A data object that contains the results of a single run of Probnic.
 */
export interface ProbeReport {
    /** Context information about the recipe used in the test. */
    readonly ctx: ProbeContext;

    /** List of results of tests for each pulse for each recipe target. */
    readonly data: ProbeSampleReport[];
}

/**
 * Represents configuration of the test that Probnic needs to run.
 */
export interface ProbeRecipe {
    /** Recipe name. */
    readonly name: string;

    /** Test type. E.g. HTTP test. */
    // TODO: Change string to a specific type
    readonly type: string;

    /** Context/extra information about the recipe. E.g. Name of the AB test. */
    readonly ctx: ProbeContext;

    /** TODO: ? */
    readonly next: number;

    /** Number of samples to get. */
    readonly pulses: number;

    /** Delay between samples. Delay is taken from the end of the previous pulse. */
    readonly pulse_delay: number;

    /** Timeout for a sample run. */
    readonly pulse_timeout: number;

    /** List of targets to sample. */
    readonly targets: ProbeTargetInfo[];
}

/**
 * A data object that contains context information about the Probe recipe.
 */
export interface ProbeContext {
    [key: string]: string | number;
}

/**
 * A data object that contains results for each pulse for a specific recipe target.
 */
export interface ProbeSampleReport {
    /** Target name. */
    readonly name: string;

    /** Target used for the test. */
    readonly target: string;

    /** List of results for each pulse in the test. */
    readonly data: ProbeReportPulse[];
}

/**
 * A data object that contains results for each pulse for a specific recipe target.
 */
export interface ProbeReportPulse {
    readonly d: number;
    readonly ttfb: number | undefined;
    readonly dns: number | undefined;
    readonly tcp: number | undefined;
    readonly tls: number | undefined;
    readonly sz: number;
    readonly sc: number;
    readonly via: string;
}

/**
 * Describes a target for the Probnic test.
 */
export interface ProbeTargetInfo {
    /** Unique name of the target */
    readonly name: string;

    /** Target path to test. Could be a URL, ip:port etc.
     * If path can't described using a single string, additional data 
     * can be provided in the ctx field.
     */
    readonly target: string;
    
    /** Extra context information necessary to test the target. */
    readonly ctx: ProbeTargetContext | undefined;
}

/**
 * Extra context information necessary to test the target.
 */
export interface ProbeTargetContext {
    [key: string]: string | number;
}