/**
 * modified from https://github.com/facebook/create-react-app
 * license at https://github.com/facebook/create-react-app/blob/master/LICENSE
 */ import type { InternalContext, PrintFileSizeAsset, RsbuildPlugin } from '../types';
/** Normalize file path by removing hash for comparison across builds */ export declare function normalizeFilePath(filePath: string): string;
/** Exclude source map and license files by default */ export declare const excludeAsset: (asset: PrintFileSizeAsset) => boolean;
export declare const pluginFileSize: (context: InternalContext) => RsbuildPlugin;
