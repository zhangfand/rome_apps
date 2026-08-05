import type { RsbuildConfig } from './types';
/**
 * Deeply merges multiple Rsbuild configuration objects.
 *
 * This function returns a new merged configuration object and does not modify
 * the input configuration objects.
 */ export declare const mergeRsbuildConfig: <T = RsbuildConfig>(...originalConfigs: (T | undefined)[]) => T;
