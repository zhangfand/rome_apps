import { type LogLevel, type RsbuildConfig, type RsbuildPlugin } from '@rsbuild/core';
import type { ParsedCommandLine } from 'typescript';
export type DtsRedirect = {
    path?: boolean;
    extension?: boolean;
};
export type ApiExtractorOptions = {
    bundledPackages?: string[];
};
export type PluginDtsOptions = {
    bundle?: boolean | ApiExtractorOptions;
    distPath?: string;
    build?: boolean;
    abortOnError?: boolean;
    dtsExtension?: string;
    alias?: Record<string, string>;
    autoExternal?: boolean | {
        dependencies?: boolean;
        optionalDependencies?: boolean;
        peerDependencies?: boolean;
        devDependencies?: boolean;
    };
    banner?: string;
    footer?: string;
    redirect?: DtsRedirect;
    tsgo?: boolean;
};
export type DtsEntry = {
    name: string;
    path: string;
};
export type DtsGenOptions = Omit<PluginDtsOptions, 'bundle'> & {
    bundle: boolean;
    name: string;
    cwd: string;
    isWatch: boolean;
    dtsEntry: DtsEntry[];
    dtsEmitPath: string;
    build?: boolean;
    tsconfigPath: string;
    tsConfigResult: ParsedCommandLine;
    userExternals?: NonNullable<RsbuildConfig['output']>['externals'];
    apiExtractorOptions?: ApiExtractorOptions;
    loggerLevel: LogLevel;
};
export declare const PLUGIN_DTS_NAME = "rsbuild:dts";
export declare const pluginDts: (options?: PluginDtsOptions) => RsbuildPlugin;
