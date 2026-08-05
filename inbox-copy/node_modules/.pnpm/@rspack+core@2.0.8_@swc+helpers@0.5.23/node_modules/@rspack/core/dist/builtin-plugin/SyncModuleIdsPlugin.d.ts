import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import type { Module } from '../Module.js';
import { RspackBuiltinPlugin } from './base.js';
export interface SyncModuleIdsPluginOptions {
    path: string;
    context?: string;
    test?: (module: Module) => boolean;
    mode?: 'read' | 'create' | 'merge' | 'update';
}
export declare class SyncModuleIdsPlugin extends RspackBuiltinPlugin {
    private options;
    name: BuiltinPluginName;
    affectedHooks: 'compilation';
    constructor(options: SyncModuleIdsPluginOptions);
    raw(): BuiltinPlugin;
}
