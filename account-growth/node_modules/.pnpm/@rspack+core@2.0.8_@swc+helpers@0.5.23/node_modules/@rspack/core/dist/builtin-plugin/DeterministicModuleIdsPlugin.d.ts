import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import { RspackBuiltinPlugin } from './base.js';
import type { Module } from '../Module.js';
export interface DeterministicModuleIdsPluginOptions {
    context?: string;
    test?: (module: Module) => boolean;
    maxLength?: number;
    salt?: number;
    fixedLength?: boolean;
    failOnConflict?: boolean;
}
export declare class DeterministicModuleIdsPlugin extends RspackBuiltinPlugin {
    private options;
    name: BuiltinPluginName;
    affectedHooks: 'compilation';
    constructor(options?: DeterministicModuleIdsPluginOptions);
    raw(): BuiltinPlugin;
}
