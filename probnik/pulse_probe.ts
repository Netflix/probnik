/**
 *
 *  Copyright 2018 Netflix, Inc.
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

import { Probe, RecipeProvider, ProbeReporter, ProbeRecipe, ProbePulseReport, ProbeTargetInfo, ProbePulseSampleReport, Requester, ProbeTesterFactory } from './probe';
import { TesterFactory } from './testers'

/**
 * Probe implementation
 */
export class PulseProbe implements Probe {
    /** Requester used to get data. */
    public static requester: Requester;

    /** An object that initializes ProbeTest for recipes. */
    public static testerFactory: ProbeTesterFactory

    private iteration: number;
    private nextJob?: Job;
    private completed: boolean;
    private requester: Requester; // to allow overriding requester in child classes
    private testerFactory: ProbeTesterFactory; // to allow overriding tester factory in child classes

    /**
     * @param recipeProvider An object that provides Recipe to test against.
     * @param reporter A reporter to use to send Probe results to.
     */
    constructor(public recipeProvider: RecipeProvider, public reporter: ProbeReporter) {
        this.iteration = 0;
        this.completed = false;
        this.requester = (this.constructor as any).requester;
        this.testerFactory = (this.constructor as any).testerFactory;
    }

    /** Starts/resumes execution of the test. */
    public start(): void {
        if (this.nextJob) {
            // Already started
            return;
        }
        // TODO: should we allow running the test from the same Probnik object several times?
        // Isn't the iteration property created exactly for this purpose?
        if (this.completed) {
            // The test session is completed
            return;
        }
        this.nextJob = this.scheduleAfter(0, this.run.bind(this));
    }

    /** Stops execution of the test. */
    public stop(): void {
        if (this.nextJob) {
            this.nextJob.cancel();
            this.nextJob = undefined;
        }    
    }

    /** Runs the test. */
    private run(): void {
        this.recipeProvider.getRecipe(this.iteration, this.executeTest.bind(this))
    }

    private forEachTarget(recipe: ProbeRecipe, fn: (this: PulseProbe, target: ProbeTargetInfo) => void): void {
        for (let i = 0, l = recipe.targets.length; i < l; i++) {
            fn.bind(this)(recipe.targets[i]);
        }
    }

    private executeTest(recipe: ProbeRecipe | null): void {
        if (!recipe) {
            // Invalid test recipe, abort
            this.stop();
            return;
        }
        const tester = this.testerFactory.getTester(this.requester, recipe);

        const reports: ProbePulseReport[] = [];
        const wg = new WaitGroup(recipe.targets.length);
        let scheduleAfter = this.scheduleAfter;
        this.forEachTarget(recipe, function (target) {
            const pulses: ProbePulseSampleReport[] = [];
            const handler = function (done: () => void, report: ProbePulseSampleReport) {
                pulses.push(report);
                done();
            }
            let nested = function finish() {
                reports.push({
                    'name': target.name,
                    'target': target.target,
                    'data': pulses
                });
                wg.done();
            }
            for (let i = recipe.pulses - 1; i >= 0; i--) {
                nested = (function probe(next: () => void, delay: number) {
                    const task = tester.run.bind(tester, target, handler.bind(null, next));
                    scheduleAfter(delay, task);
                }).bind(null, nested, i > 0 ? recipe.pulse_delay : 0);
            }
            // Unwrap timeout(0), probe, timeout(delay), probe, timeout(delay), probe, finish
            nested();
        });
        let finish = this.handleResult.bind(this);
        wg.wait(function () {
            finish(recipe, reports);
        });
    }

    private scheduleAfter(delayMilliseconds: number, task: Function): Job {
        let id = setTimeout(task, delayMilliseconds);
        return { cancel: function() { clearTimeout(id) } };
    }

    private handleResult(recipe: ProbeRecipe, reports: ProbePulseReport[]): void {
        // Use the injected logger to log report
        this.reporter(recipe.name, {
            ctx: recipe.ctx,
            data: reports
        });
        
        // Schedule next round if necessary
        if (!this.nextJob) {
            // Tester is stopped
            return;
        }
        if (recipe.next > 0) {
            this.nextJob = this.scheduleAfter(recipe.next, this.run.bind(this));
        } else {
            this.completed = true;
            this.stop();
        }
    }
}

/**
 * Syncronizes ProbeTester runs between pulses.
 */
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

/**
 * Cancellable job.
 */
export interface Job {
    cancel(): void;
}

PulseProbe.testerFactory = new TesterFactory();