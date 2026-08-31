import { Pluggable } from 'unified';

/**
 * Plugin for math rendering (KaTeX)
 */
interface MathPlugin {
    name: "katex";
    type: "math";
    /**
     * Remark plugin for parsing math syntax
     */
    remarkPlugin: Pluggable;
    /**
     * Rehype plugin for rendering math
     */
    rehypePlugin: Pluggable;
    /**
     * Get CSS styles path for math rendering
     */
    getStyles?: () => string;
}
/**
 * Options for creating a math plugin
 */
interface MathPluginOptions {
    /**
     * Enable single dollar sign for inline math ($...$)
     * @default false
     */
    singleDollarTextMath?: boolean;
    /**
     * KaTeX error color
     * @default "var(--color-muted-foreground)"
     */
    errorColor?: string;
}
/**
 * Create a math plugin with optional configuration
 */
declare function createMathPlugin(options?: MathPluginOptions): MathPlugin;
/**
 * Pre-configured math plugin with default settings
 */
declare const math: MathPlugin;

export { type MathPlugin, type MathPluginOptions, createMathPlugin, math };
