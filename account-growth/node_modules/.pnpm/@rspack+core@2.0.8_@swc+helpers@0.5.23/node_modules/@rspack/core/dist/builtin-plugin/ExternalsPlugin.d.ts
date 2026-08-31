import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import type { Externals } from '../index.js';
import { RspackBuiltinPlugin } from './base.js';
export declare class ExternalsPlugin extends RspackBuiltinPlugin {
    #private;
    private type;
    private externals;
    private placeInInitial?;
    private fallbackType?;
    name: BuiltinPluginName;
    constructor(type: string, externals: Externals, placeInInitial?: boolean | undefined, fallbackType?: string | undefined);
    raw(): BuiltinPlugin | undefined;
}
