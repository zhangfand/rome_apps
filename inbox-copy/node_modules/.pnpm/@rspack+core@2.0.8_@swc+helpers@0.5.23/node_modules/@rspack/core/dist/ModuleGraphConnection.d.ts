import binding, { ModuleGraphConnection as BindingModuleGraphConnection } from '@rspack/binding';
type ModuleGraphConnectionConstructor = typeof BindingModuleGraphConnection & {
    readonly TRANSITIVE_ONLY: typeof binding.TRANSITIVE_ONLY_SYMBOL;
    readonly CIRCULAR_CONNECTION: typeof binding.CIRCULAR_CONNECTION_SYMBOL;
};
export interface ModuleGraphConnection extends BindingModuleGraphConnection {
}
export declare const ModuleGraphConnection: ModuleGraphConnectionConstructor;
export type ConnectionState = boolean | typeof ModuleGraphConnection.TRANSITIVE_ONLY | typeof ModuleGraphConnection.CIRCULAR_CONNECTION;
export {};
