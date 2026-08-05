import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import type { Compilation } from '../Compilation.js';
import type { Compiler } from '../Compiler.js';
import type { Module } from '../Module.js';
import { RspackBuiltinPlugin } from './base.js';
export type CircularCheckRspackPluginOptions = {
    /**
     * Exclude detection of files based on a RegExp.
     */
    exclude?: RegExp;
    /**
     * Include specific files based on a RegExp.
     */
    include?: RegExp;
    /**
     * Add errors to rspack instead of warnings.
     */
    failOnError?: boolean;
    /**
     * Called for each detected circular dependency.
     */
    onDetected?(args: {
        module: Module;
        paths: string[];
        compilation: Compilation;
    }): void;
};
export declare class CircularCheckRspackPlugin extends RspackBuiltinPlugin {
    name: BuiltinPluginName;
    _options: CircularCheckRspackPluginOptions;
    constructor(options?: CircularCheckRspackPluginOptions);
    raw(compiler: Compiler): BuiltinPlugin;
}
