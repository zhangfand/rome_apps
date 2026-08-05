import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import { RspackBuiltinPlugin } from './base.js';
export declare class SideEffectsFlagPlugin extends RspackBuiltinPlugin {
    private analyzeSideEffectsFree;
    name: BuiltinPluginName;
    affectedHooks: 'compilation';
    constructor(analyzeSideEffectsFree?: boolean);
    raw(): BuiltinPlugin;
}
