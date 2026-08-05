/**
 * The following code is modified based on
 * https://github.com/webpack/webpack/blob/v5.88.2/lib/RuntimeGlobals.js
 *
 * MIT Licensed
 * Author Tobias Koppers \@sokra
 * Copyright (c) JS Foundation and other contributors
 * https://github.com/webpack/webpack/blob/main/LICENSE
 */
import type { JsRuntimeGlobals } from '@rspack/binding';
import type { RspackOptionsNormalized } from './config/index.js';
export declare function __from_binding_runtime_globals(runtimeRequirements: JsRuntimeGlobals, compilerRuntimeGlobals: Record<string, string>): Set<string>;
export declare function __to_binding_runtime_globals(runtimeRequirements: Set<string>, compilerRuntimeGlobals: Record<string, string>): JsRuntimeGlobals;
declare enum RuntimeGlobals {
    /**
     * the internal require function
     */
    require = 0,
    /**
     * access to properties of the internal require function/object
     */
    requireScope = 1,
    /**
     * the internal exports object
     */
    exports = 2,
    /**
     * top-level this need to be the exports object
     */
    thisAsExports = 3,
    /**
     * runtime need to return the exports of the last entry module
     */
    returnExportsFromRuntime = 4,
    /**
     * the internal module object
     */
    module = 5,
    /**
     * the internal module object
     */
    moduleId = 6,
    /**
     * the internal module object
     */
    moduleLoaded = 7,
    /**
     * the bundle public path
     */
    publicPath = 8,
    /**
     * the module id of the entry point
     */
    entryModuleId = 9,
    /**
     * the module cache
     */
    moduleCache = 10,
    /**
     * the module functions
     */
    moduleFactories = 11,
    /**
     * the module functions, with only write access
     */
    moduleFactoriesAddOnly = 12,
    /**
     * the chunk ensure function
     */
    ensureChunk = 13,
    /**
     * an object with handlers to ensure a chunk
     */
    ensureChunkHandlers = 14,
    /**
     * a runtime requirement if ensureChunkHandlers should include loading of chunk needed for entries
     */
    ensureChunkIncludeEntries = 15,
    /**
     * the chunk prefetch function
     */
    prefetchChunk = 16,
    /**
     * an object with handlers to prefetch a chunk
     */
    prefetchChunkHandlers = 17,
    /**
     * the chunk preload function
     */
    preloadChunk = 18,
    /**
     * an object with handlers to preload a chunk
     */
    preloadChunkHandlers = 19,
    /**
     * the exported property define getters function
     */
    definePropertyGetters = 20,
    /**
     * define compatibility on export
     */
    makeNamespaceObject = 21,
    /**
     * create a fake namespace object
     */
    createFakeNamespaceObject = 22,
    /**
     * compatibility get default export
     */
    compatGetDefaultExport = 23,
    /**
     * ES modules decorator
     */
    harmonyModuleDecorator = 24,
    /**
     * node.js module decorator
     */
    nodeModuleDecorator = 25,
    /**
     * the webpack hash
     */
    getFullHash = 26,
    /**
     * an object containing all installed WebAssembly.Instance export objects keyed by module id
     */
    wasmInstances = 27,
    /**
     * instantiate a wasm instance from module exports object, id, hash and importsObject
     */
    instantiateWasm = 28,
    /**
     * compile a wasm module from id and hash
     */
    compileWasm = 29,
    /**
     * the uncaught error handler for the webpack runtime
     */
    uncaughtErrorHandler = 30,
    /**
     * the script nonce
     */
    scriptNonce = 31,
    /**
     * function to load a script tag.
     * Arguments: (url: string, done: (event) =\> void), key?: string | number, chunkId?: string | number) =\> void
     * done function is called when loading has finished or timeout occurred.
     * It will attach to existing script tags with data-webpack == uniqueName + ":" + key or src == url.
     */
    loadScript = 32,
    /**
     * function to promote a string to a TrustedScript using webpack's Trusted
     * Types policy
     * Arguments: (script: string) =\> TrustedScript
     */
    createScript = 33,
    /**
     * function to promote a string to a TrustedScriptURL using webpack's Trusted
     * Types policy
     * Arguments: (url: string) =\> TrustedScriptURL
     */
    createScriptUrl = 34,
    /**
     * function to return webpack's Trusted Types policy
     * Arguments: () =\> TrustedTypePolicy
     */
    getTrustedTypesPolicy = 35,
    /**
     * a flag when a chunk has a fetch priority
     */
    hasFetchPriority = 36,
    /**
     * the chunk name of the chunk with the runtime
     */
    chunkName = 37,
    /**
     * the runtime id of the current runtime
     */
    runtimeId = 38,
    /**
     * the filename of the script part of the chunk
     */
    getChunkScriptFilename = 39,
    /**
     * the filename of the css part of the chunk
     */
    getChunkCssFilename = 40,
    /**
     * rspack version
     * @internal
     */
    rspackVersion = 41,
    /**
     * a flag when a module/chunk/tree has css modules
     */
    hasCssModules = 42,
    /**
     * rspack unique id
     * @internal
     */
    rspackUniqueId = 43,
    /**
     * the filename of the script part of the hot update chunk
     */
    getChunkUpdateScriptFilename = 44,
    /**
     * the filename of the css part of the hot update chunk
     */
    getChunkUpdateCssFilename = 45,
    /**
     * startup signal from runtime
     * This will be called when the runtime chunk has been loaded.
     */
    startup = 46,
    /**
     * @deprecated
     * creating a default startup function with the entry modules
     */
    startupNoDefault = 47,
    /**
     * startup signal from runtime but only used to add logic after the startup
     */
    startupOnlyAfter = 48,
    /**
     * startup signal from runtime but only used to add sync logic before the startup
     */
    startupOnlyBefore = 49,
    /**
     * global callback functions for installing chunks
     */
    chunkCallback = 50,
    /**
     * method to startup an entrypoint with needed chunks.
     * Signature: (moduleId: Id, chunkIds: Id[]) =\> any.
     * Returns the exports of the module or a Promise
     */
    startupEntrypoint = 51,
    /**
     * startup signal from runtime for chunk dependencies
     */
    startupChunkDependencies = 52,
    /**
     * register deferred code, which will run when certain
     * chunks are loaded.
     * Signature: (chunkIds: Id[], fn: () =\> any, priority: int \>= 0 = 0) =\> any
     * Returned value will be returned directly when all chunks are already loaded
     * When (priority & 1) it will wait for all other handlers with lower priority to
     * be executed before itself is executed
     */
    onChunksLoaded = 53,
    /**
     * method to install a chunk that was loaded somehow
     * Signature: (\{ id, ids, modules, runtime \}) =\> void
     */
    externalInstallChunk = 54,
    /**
     * interceptor for module executions
     */
    interceptModuleExecution = 55,
    /**
     * the global object
     */
    global = 56,
    /**
     * an object with all share scopes
     */
    shareScopeMap = 57,
    /**
     * The sharing init sequence function (only runs once per share scope).
     * Has one argument, the name of the share scope.
     * Creates a share scope if not existing
     */
    initializeSharing = 58,
    /**
     * The current scope when getting a module from a remote
     */
    currentRemoteGetScope = 59,
    /**
     * the filename of the HMR manifest
     */
    getUpdateManifestFilename = 60,
    /**
     * function downloading the update manifest
     */
    hmrDownloadManifest = 61,
    /**
     * array with handler functions to download chunk updates
     */
    hmrDownloadUpdateHandlers = 62,
    /**
     * object with all hmr module data for all modules
     */
    hmrModuleData = 63,
    /**
     * array with handler functions when a module should be invalidated
     */
    hmrInvalidateModuleHandlers = 64,
    /**
     * the prefix for storing state of runtime modules when hmr is enabled
     */
    hmrRuntimeStatePrefix = 65,
    /**
     * the AMD define function
     */
    amdDefine = 66,
    /**
     * the AMD options
     */
    amdOptions = 67,
    /**
     * the System polyfill object
     */
    system = 68,
    /**
     * the shorthand for Object.prototype.hasOwnProperty
     * using of it decreases the compiled bundle size
     */
    hasOwnProperty = 69,
    /**
     * the System.register context object
     */
    systemContext = 70,
    /**
     * the baseURI of current document
     */
    baseURI = 71,
    /**
     * a RelativeURL class when relative URLs are used
     */
    relativeUrl = 72,
    /**
     * Creates an async module. The body function must be a async function.
     * "module.exports" will be decorated with an AsyncModulePromise.
     * The body function will be called.
     * To handle async dependencies correctly do this: "([a, b, c] = await handleDependencies([a, b, c]));".
     * If "hasAwaitAfterDependencies" is truthy, "handleDependencies()" must be called at the end of the body function.
     * Signature: function(
     * module: Module,
     * body: (handleDependencies: (deps: AsyncModulePromise[]) =\> Promise\<any[]\> & () =\> void,
     * hasAwaitAfterDependencies?: boolean
     * ) =\> void
     */
    asyncModule = 73,
    asyncModuleExportSymbol = 74,
    makeDeferredNamespaceObject = 75,
    makeDeferredNamespaceObjectSymbol = 76
}
export declare const isReservedRuntimeGlobal: (r: string, compilerRuntimeGlobals: Record<string, string>) => boolean;
export declare function renderModulePrefix(_compilerOptions: RspackOptionsNormalized): string;
export declare enum RuntimeVariable {
    Require = 0,
    Modules = 1,
    ModuleCache = 2,
    Module = 3,
    Exports = 4,
    StartupExec = 5
}
export declare function renderRuntimeVariables(variable: RuntimeVariable, _compilerOptions?: RspackOptionsNormalized): string;
export declare function createCompilerRuntimeGlobals(compilerOptions?: RspackOptionsNormalized): Record<keyof typeof RuntimeGlobals, string>;
declare const DefaultRuntimeGlobals: Record<"amdDefine" | "amdOptions" | "asyncModule" | "asyncModuleExportSymbol" | "baseURI" | "chunkCallback" | "chunkName" | "compatGetDefaultExport" | "compileWasm" | "createFakeNamespaceObject" | "createScript" | "createScriptUrl" | "currentRemoteGetScope" | "definePropertyGetters" | "ensureChunk" | "ensureChunkHandlers" | "ensureChunkIncludeEntries" | "entryModuleId" | "exports" | "externalInstallChunk" | "getChunkCssFilename" | "getChunkScriptFilename" | "getChunkUpdateCssFilename" | "getChunkUpdateScriptFilename" | "getFullHash" | "getTrustedTypesPolicy" | "getUpdateManifestFilename" | "global" | "harmonyModuleDecorator" | "hasCssModules" | "hasFetchPriority" | "hasOwnProperty" | "hmrDownloadManifest" | "hmrDownloadUpdateHandlers" | "hmrInvalidateModuleHandlers" | "hmrModuleData" | "hmrRuntimeStatePrefix" | "initializeSharing" | "instantiateWasm" | "interceptModuleExecution" | "loadScript" | "makeDeferredNamespaceObject" | "makeDeferredNamespaceObjectSymbol" | "makeNamespaceObject" | "module" | "moduleCache" | "moduleFactories" | "moduleFactoriesAddOnly" | "moduleId" | "moduleLoaded" | "nodeModuleDecorator" | "onChunksLoaded" | "prefetchChunk" | "prefetchChunkHandlers" | "preloadChunk" | "preloadChunkHandlers" | "publicPath" | "relativeUrl" | "require" | "requireScope" | "returnExportsFromRuntime" | "rspackUniqueId" | "rspackVersion" | "runtimeId" | "scriptNonce" | "shareScopeMap" | "startup" | "startupChunkDependencies" | "startupEntrypoint" | "startupNoDefault" | "startupOnlyAfter" | "startupOnlyBefore" | "system" | "systemContext" | "thisAsExports" | "uncaughtErrorHandler" | "wasmInstances", string>;
export { DefaultRuntimeGlobals as RuntimeGlobals };
