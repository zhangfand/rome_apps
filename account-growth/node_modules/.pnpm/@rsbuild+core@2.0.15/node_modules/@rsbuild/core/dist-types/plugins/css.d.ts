import type { CSSLoaderOptions, NormalizedEnvironmentConfig, RsbuildPlugin, Rspack } from '../types';
export declare function getLightningCSSLoaderOptions(config: NormalizedEnvironmentConfig, targets: string[], minify: boolean): Promise<Rspack.LightningcssLoaderOptions>;
// If the target is not `web` and the modules option of css-loader is enabled,
// we must enable exportOnlyLocals to only exports the modules identifier mappings.
// Otherwise, the compiled CSS code may contain invalid code, such as `new URL`.
// https://github.com/webpack/css-loader#exportonlylocals
export declare const normalizeCssLoaderOptions: (options: CSSLoaderOptions, exportOnlyLocals: boolean) => CSSLoaderOptions;
export declare const pluginCss: () => RsbuildPlugin;
