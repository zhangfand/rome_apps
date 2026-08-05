let CSS_MODULE_REGEX = /\.module(s)?\.\w+$/i, CSS_ICSS_REGEX = /\.icss\.\w+$/i, isCSSModules = (modules, loaderContext)=>{
    if (!modules) return !1;
    if (!0 === modules || 'string' == typeof modules) return !0;
    let { auto } = modules;
    if (void 0 === auto) return !0;
    if (!1 === auto) return !1;
    let resourcePath = loaderContext._module?.matchResource || loaderContext.resourcePath;
    return auto instanceof RegExp ? auto.test(resourcePath) : 'function' == typeof auto ? auto(resourcePath, loaderContext.resourceQuery, loaderContext.resourceFragment) : CSS_MODULE_REGEX.test(resourcePath) || CSS_ICSS_REGEX.test(resourcePath);
};
export { isCSSModules };
