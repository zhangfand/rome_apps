import type { Compiler } from '../Compiler.js';
import type { ModuleFederationPluginOptions } from '../container/ModuleFederationPlugin.js';
import { type ShareFallback } from './IndependentSharedPlugin.js';
export interface TreeshakingSharedPluginOptions {
    mfConfig: ModuleFederationPluginOptions;
    secondary?: boolean;
    onBuildAssets?: (buildAssets: ShareFallback) => void;
}
export declare class TreeShakingSharedPlugin {
    mfConfig: ModuleFederationPluginOptions;
    outputDir: string;
    secondary?: boolean;
    onBuildAssets?: (buildAssets: ShareFallback) => void;
    private _independentSharePlugin?;
    name: string;
    constructor(options: TreeshakingSharedPluginOptions);
    apply(compiler: Compiler): void;
    get buildAssets(): ShareFallback;
}
