import { type RawHashedModuleIdsPluginOptions } from '@rspack/binding';
export declare const HashedModuleIdsPlugin: {
    new (options?: RawHashedModuleIdsPluginOptions | undefined): {
        name: string;
        _args: [options?: RawHashedModuleIdsPluginOptions | undefined];
        affectedHooks: keyof import("../index.js").CompilerHooks | undefined;
        raw(compiler: import("../index.js").Compiler): import("@rspack/binding").BuiltinPlugin;
        apply(compiler: import("../index.js").Compiler): void;
    };
};
