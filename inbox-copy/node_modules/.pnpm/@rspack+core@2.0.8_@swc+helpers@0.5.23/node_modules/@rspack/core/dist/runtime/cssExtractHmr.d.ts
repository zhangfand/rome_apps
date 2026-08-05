export declare function normalizeUrl(url: string): string;
type DebouncedFunction<T extends (...args: any[]) => any> = (...args: Parameters<T>) => void;
declare function cssReload(moduleId: string, options: Record<string, any>): DebouncedFunction<() => void>;
export { cssReload };
