import node_path from "node:path";
let INLINE_QUERY_REGEX = /[?&]inline(?:&|=|$)/, JS_FILE_REGEX = /\.m?js(?:\?.*)?$/, SOURCE_MAPPING_URL_REGEX = /(?:\/\*# sourceMappingURL=.*?\*\/|\/\/# sourceMappingURL=.*)$/gm, getWorkerOptionsCode = (isModule)=>`{
  ${isModule ? 'type: "module",' : ''}
  name: options && options.name
}`, deleteAsset = (compilation, filename)=>{
    compilation.getAsset(filename) && compilation.deleteAsset(filename);
}, workerLoader_workerLoader = async function workerLoader() {
    let callback = this.async(), isModule = !!this._compilation.outputOptions.module;
    try {
        if (!INLINE_QUERY_REGEX.test(this.resourceQuery)) return void callback(null, (({ resourcePath, isModule })=>{
            let resourcePath1, workerRequest = (resourcePath1 = resourcePath, `./${node_path.basename(resourcePath1).replace(/\\/g, '/')}`), workerOptions = getWorkerOptionsCode(isModule);
            return `export default function WorkerWrapper(options) {
  return new Worker(new URL(${JSON.stringify(workerRequest)}, import.meta.url), ${workerOptions});
}`;
        })({
            resourcePath: this.resourcePath,
            isModule
        }));
        let source = await ((context)=>{
            let compiler = context._compiler, compilation = context._compilation, { rspack } = compiler, { outputOptions } = compilation, compilerName = `rsbuild-worker ${context.resourcePath}`, childCompiler = compilation.createChildCompiler(compilerName, {
                publicPath: outputOptions.publicPath,
                globalObject: 'self',
                module: outputOptions.module,
                chunkFormat: outputOptions.module ? 'module' : void 0,
                chunkLoading: outputOptions.module ? 'import' : void 0,
                workerChunkLoading: outputOptions.workerChunkLoading,
                wasmLoading: outputOptions.wasmLoading,
                workerWasmLoading: outputOptions.workerWasmLoading
            }, []);
            new rspack.webworker.WebWorkerTemplatePlugin().apply(childCompiler);
            let moduleOptions = childCompiler.options.module, parserOptions = moduleOptions.parser ?? {};
            return childCompiler.options.module = {
                ...moduleOptions,
                parser: {
                    ...parserOptions,
                    javascript: {
                        ...parserOptions.javascript,
                        dynamicImportMode: 'eager'
                    }
                }
            }, new rspack.LoaderTargetPlugin('webworker').apply(childCompiler), new rspack.EntryPlugin(context.context ?? node_path.dirname(context.resourcePath), context.resourcePath, node_path.parse(context.resourcePath).name).apply(childCompiler), new Promise((resolve, reject)=>{
                childCompiler.runAsChild((error, entries, childCompilation)=>{
                    if (error) return void reject(error);
                    let entry = entries?.[0];
                    if (!entry || !childCompilation) return void reject(Error(`[rsbuild:worker] Failed to compile inline worker "${context.resourcePath}".`));
                    let workerFilename = [
                        ...entry.files
                    ].filter((file)=>JS_FILE_REGEX.test(file))[0];
                    if (!workerFilename) return void reject(Error(`[rsbuild:worker] Failed to find the inline worker output for "${context.resourcePath}".`));
                    if (childCompilation.getAssets().map((asset)=>asset.name).filter((file)=>file !== workerFilename && JS_FILE_REGEX.test(file)).length > 0) return void reject(Error(`[rsbuild:worker] Inline workers do not support code splitting yet. Use ?worker instead, or remove dynamic imports from "${context.resourcePath}".`));
                    let asset = childCompilation.getAsset(workerFilename);
                    if (!asset) return void reject(Error(`[rsbuild:worker] Failed to read the inline worker output "${workerFilename}".`));
                    for (let file of (deleteAsset(compilation, workerFilename), deleteAsset(compilation, `${workerFilename}.map`), childCompilation.fileDependencies))context.addDependency(file);
                    for (let dir of childCompilation.contextDependencies)context.addContextDependency(dir);
                    for (let missing of childCompilation.missingDependencies)context.addMissingDependency(missing);
                    resolve(asset.source.source().toString());
                });
            });
        })(this);
        callback(null, (({ source, isModule })=>{
            let workerOptions = getWorkerOptionsCode(isModule), revokeCode = isModule ? 'URL.revokeObjectURL(import.meta.url);' : '(self.URL || self.webkitURL).revokeObjectURL(self.location.href);';
            return `const jsContent = ${JSON.stringify(source.replace(SOURCE_MAPPING_URL_REGEX, ''))};
const workerURL = typeof self !== "undefined" && (self.URL || self.webkitURL);
const blob = workerURL && self.Blob && new Blob([${JSON.stringify(revokeCode)}, jsContent], { type: "text/javascript;charset=utf-8" });

export default function WorkerWrapper(options) {
  let objURL;
  try {
    objURL = blob && workerURL.createObjectURL(blob);
    if (!objURL) throw "";
    const worker = new Worker(objURL, ${workerOptions});
    worker.addEventListener("error", () => {
      workerURL.revokeObjectURL(objURL);
    });
    return worker;
  } catch (e) {
    if (objURL) {
      workerURL.revokeObjectURL(objURL);
    }
    return new Worker(
      "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
      ${workerOptions}
    );
  }
}`;
        })({
            source,
            isModule
        }));
    } catch (error) {
        callback(error instanceof Error ? error : Error(String(error)));
    }
};
export default workerLoader_workerLoader;
