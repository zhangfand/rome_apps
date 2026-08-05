import type { Externals } from '@rspack/core';
import { type PackageJson } from '../helpers/packageJson';
import type { AutoExternal, RsbuildPlugin } from '../types';
export declare const composeAutoExternalRules: (options: {
    autoExternal?: AutoExternal;
    pkgJson?: PackageJson;
    userExternals?: Externals;
}) => RegExp[] | undefined;
export declare function pluginExternals(): RsbuildPlugin;
