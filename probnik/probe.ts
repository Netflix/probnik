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
 * Contains public interfaces for the Probnik runtime.
 */

 /**
 * A component that executes a series of tests and reports performance of several test targets.
 */
export interface Probe {
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
 * Receives a report with Probe results. 
 */
export type ProbeReporter = (report: ProbeReport) => void;

 /**
 * Provides a probe recipe to test.
 */
export interface RecipeProvider {
    /** Provides a probe recipe to test. */
    getRecipe(iteration: number, cb: (params: ProbeRecipe | null) => void): void;
}

 /**
 * A data object that contains the results of a single Probe run.
 */
export interface ProbeReport {
    /** Context information about the recipe used in the test. */
    readonly ctx: ProbeContext;

    /** Recipe type. */
    readonly type: string;

    /** Probe recipe name. */
    readonly name: string;

    /** List of results of tests for each pulse for each recipe target. */
    readonly data: ProbePulseReport[];
}

/**
 * Represents configuration of the test that a Probe needs to run.
 */
export interface ProbeRecipe {
    /** Recipe name. */
    readonly name: string;

    /** Test type. E.g. HTTP test. */
    readonly type: string;

    /** Context/extra information about the recipe. E.g. Name of the AB test that get carried over in the reports. */
    readonly ctx: ProbeContext;

    /** Delay (in ms) to repeat a probe run after recipe completion. Repeat is disabled if missing or 0. */
    readonly next: number;

    /** Number of times to repeat testing for each target. */
    readonly pulses: number;

    /** Delay between pulses. Delay is taken from the end of the previous pulse. */
    readonly pulse_delay: number;

    /** Timeout for a individual pulse run. */
    readonly pulse_timeout: number;

    /** List of targets to test. */
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
export interface ProbePulseReport {
    /** Target name. */
    readonly name: string;

    /** Target used for the test. */
    readonly target: string;

    /** List of results for each pulse in the test. */
    readonly data: ProbePulseSampleReport[];
}

/**
 * A data object that contains results for each pulse for a specific recipe target.
 */
export interface ProbePulseSampleReport {
    /** Pulse start time. */
    start: number;
    /** Request duration. Pulse end is start + d. */
    d: number;
    /** Status code of the request. */
    sc: number;
    /** Extra information associated with the response. */
    [key: string]: string | number | undefined;
}

/**
 * Describes a target for the Probnik test.
 */
export interface ProbeTargetInfo {
    /** Unique name of the target in the recipe. */
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

/**
 * Makes a request to test a target.
 */
export interface Requester {
    get(target: string, timeout: number, cb: RequesterCallback, options: RequesterOptions): void
}

/**
 * Receives a result of a request.
 */
export type RequesterCallback = (report: ProbePulseSampleReport) => void;

/**
 * A data object that contains context information about the Probe recipe.
 */
export interface RequesterOptions {
    [key: string]: any;
}

/**
 * Gets a performance sample of a given target.
 */
export interface ProbeTester {
    run(target: ProbeTargetInfo, cb: (report: ProbePulseSampleReport) => void): void;
}

/**
 * Initializes a ProbeTester for a given recipe.
 */
export interface ProbeTesterFactory {
    getTester(requester: Requester, recipe: ProbeRecipe): ProbeTester;
}
