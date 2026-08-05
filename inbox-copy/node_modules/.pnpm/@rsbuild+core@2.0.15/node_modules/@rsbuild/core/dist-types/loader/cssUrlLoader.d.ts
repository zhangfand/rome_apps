import type { AssetInfo, LoaderDefinitionFunction, PathData, PitchLoaderDefinitionFunction } from '@rspack/core';
import type { CSSLoaderOptions } from '../types';
type CSSUrlLoaderOptions = {
    filename: string | ((pathData: PathData, assetInfo?: AssetInfo) => string);
    modules: CSSLoaderOptions['modules'];
};
declare const cssUrlLoader: LoaderDefinitionFunction<CSSUrlLoaderOptions>;
export declare const pitch: PitchLoaderDefinitionFunction<CSSUrlLoaderOptions>;
export default cssUrlLoader;
