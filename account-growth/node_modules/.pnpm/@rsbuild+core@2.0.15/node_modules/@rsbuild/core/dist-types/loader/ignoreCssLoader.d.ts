import type { LoaderDefinition, PitchLoaderDefinitionFunction } from '@rspack/core';
import type { CSSLoaderOptions } from '../types';
type IgnoreCssLoaderOptions = {
    modules?: CSSLoaderOptions['modules'];
};
declare const ignoreCssLoader: LoaderDefinition<IgnoreCssLoaderOptions>;
// In non-emitting builds, skip css-loader and following CSS transforms for global CSS.
// CSS Modules must still pass through css-loader so SSR builds can export locals.
export declare const pitch: PitchLoaderDefinitionFunction<IgnoreCssLoaderOptions>;
export default ignoreCssLoader;
