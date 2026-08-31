export declare const HttpExternalsRspackPlugin: {
    new (webAsync: boolean): {
        name: string;
        _args: [webAsync: boolean];
        affectedHooks: keyof import("../index.js").CompilerHooks | undefined;
        raw(compiler: import("../index.js").Compiler): import("@rspack/binding").BuiltinPlugin;
        apply(compiler: import("../index.js").Compiler): void;
    };
};
