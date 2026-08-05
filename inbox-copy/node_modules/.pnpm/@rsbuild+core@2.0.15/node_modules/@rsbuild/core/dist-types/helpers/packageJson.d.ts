export type PackageJson = Partial<{
    name: string;
    type: string;
    dependencies: Record<string, string>;
    optionalDependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    devDependencies: Record<string, string>;
}>;
export declare const readPackageJsonByPath: (pkgJsonPath: string) => Promise<PackageJson | undefined>;
