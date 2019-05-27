import { Probnic, RecipeProvider, ProbeReporter, ProbeRecipe, ProbeContext, ProbeSampleReport, ProbeTargetInfo, ProbeReportPulse } from './probnic';
import { HttpRequester, HttpHeaders, HttpMetrics } from './requester';
import { XhrHttpRequester } from './xhr_requester';

export class BrowserProbnic implements Probnic {
    /** Requester used to get data */
    public static requester: HttpRequester;

    public static scheduler: Scheduler;

    private iteration: number;
    private nextJob?: Job;
    private completed: boolean;

    /**
     * @param recipeProvider An object that provides Recipe to test against.
     * @param reporter A reporter to use to send Probe results to.
     */
    constructor(public recipeProvider: RecipeProvider, public reporter: ProbeReporter) {
        this.iteration = 0;
        this.completed = false;
        //const delimiter = this.apiEndpoint.indexOf('?') === -1 ? '?' : '&';
        //const monotonic = window.performance && window.performance.now ? 'true' : 'false';
        //this.apiEndpoint = `${this.apiEndpoint}${delimiter}monotonic=${monotonic}`;
    }

    /** Starts/resumes execution of the test. */
    public start(): void {
        if (this.nextJob) {
            // Already started
            return;
        }
        // TODO: should we allow running the test from the same Probnic object several times?
        // Isn't the iteration property created exactly for this purpose?
        if (this.completed) {
            // The test session is completed
            return;
        }
        this.nextJob = BrowserProbnic.scheduler.scheduleAfter(0, this.run.bind(this));
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
        //const endpoint = `${this.apiEndpoint}&iter=${this.iteration}`;
        this.recipeProvider.getRecipe(this.executeTest.bind(this))
    }

    private executeTest(params: ProbeRecipe | null): void {
        if (!params) {
            // Invalid test config, abandon the test alltogether
            this.stop();
            return;
        }
        //TODO: check recipe type and only tuse HttpTest for HTTP recipes
        const test = new HttpTest(params.targets, params.pulses, params.pulse_delay, params.pulse_timeout);
        test.run(this.handleResult.bind(this, params.name, params.ctx, params.next));
    }

    private handleResult(recipe: string, ctx: ProbeContext, next: number, reports: ProbeSampleReport[]): void {
        // Use the injected logger to log report
        this.reporter(recipe, {
            ctx: ctx,
            data: reports
        });
        
        // Schedule next round if necessary
        if (!this.nextJob) {
            // Tester is stopped
            return;
        }
        if (next > 0) {
            this.nextJob = BrowserProbnic.scheduler.scheduleAfter(next, this.run.bind(this));
        } else {
            this.completed = true;
            this.stop();
        }
    }
}

//TODO: add a Test interface and convert it to implement this interface
class HttpTest {
    constructor(
        private targets: ProbeTargetInfo[],
        private pulses: number,
        private pulse_delay: number,
        private pulse_timeout: number) {
    }

    private forEachTarget(fn: (this: HttpTest, target: string, name: string) => void): void {
        for (let i = 0, l = this.targets.length; i < l; i++) {
            const info = this.targets[i];
            fn.bind(this)(info['target'], info['name']);
        }
    }

    public run(cb: (reports: ProbeSampleReport[]) => void) {
        const reports: ProbeSampleReport[] = [];
        const wg = new WaitGroup(this.targets.length);
        this.forEachTarget(function (target, name) {
            const pulses: ProbeReportPulse[] = [];
            const handler = function (done: () => void, status: number, headers: HttpHeaders, body: string | null, metrics: HttpMetrics) {
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
                    'target': target,
                    'data': pulses
                });
                wg.done();
            }
            for (let i = this.pulses - 1; i >= 0; i--) {
                const pulse_timeout = this.pulse_timeout;
                nested = (function probe(next: () => void, delay: number) {
                    const task = BrowserProbnic.requester.get.bind(null, target, false, pulse_timeout, handler.bind(null, next));
                    BrowserProbnic.scheduler.scheduleAfter(delay, task);
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

export interface Job {
    cancel(): void;
}

export interface Scheduler {
    scheduleAfter(delayMilliseconds: number, task: Function): Job;
}

class SchedulerImpl implements Scheduler {
    public scheduleAfter(delayMilliseconds: number, task: Function): Job {
        let id = setTimeout(task, delayMilliseconds);
        return { cancel: function() { clearTimeout(id) } };
    }
}

BrowserProbnic.scheduler = new SchedulerImpl();

BrowserProbnic.requester = new XhrHttpRequester();