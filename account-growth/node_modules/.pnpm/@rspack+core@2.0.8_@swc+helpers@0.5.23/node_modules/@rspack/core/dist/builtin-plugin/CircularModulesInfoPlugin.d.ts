import { type BuiltinPlugin, BuiltinPluginName } from '@rspack/binding';
import type { Compiler } from '../Compiler.js';
import { RspackBuiltinPlugin } from './base.js';
export declare class CircularModulesInfoPlugin extends RspackBuiltinPlugin {
    name: BuiltinPluginName;
    raw(_compiler: Compiler): BuiltinPlugin;
}
