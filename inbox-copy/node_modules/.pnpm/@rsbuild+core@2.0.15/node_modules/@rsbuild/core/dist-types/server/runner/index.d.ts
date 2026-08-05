/**
 * The following code is modified based on @rspack/test-tools/runner
 */ import type { RunnerFactoryOptions } from './type';
export declare const run: <T>({ bundlePath, ...runnerFactoryOptions }: RunnerFactoryOptions & {
    bundlePath: string;
}) => Promise<T>;
