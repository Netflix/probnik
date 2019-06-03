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
 * Contains implementations of Probe testers.
 */

import { ProbeTester, Requester, ProbeRecipe, ProbeTesterFactory } from '../probe';
import { HttpTester } from './http_tester';

/**
 * Initializes ProbeTesters for given recipes.
 */
export class TesterFactory implements ProbeTesterFactory {
    getTester(requester: Requester, recipe: ProbeRecipe): ProbeTester {
        if (recipe.type == 'http_get') {
            return new HttpTester(requester, recipe.pulse_timeout);
        }
        throw new Error(`${recipe.type}: inknown recipe type`);
    }
}
