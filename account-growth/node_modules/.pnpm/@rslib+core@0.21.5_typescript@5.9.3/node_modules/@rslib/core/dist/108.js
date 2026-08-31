import node_path from "node:path";
const SWC_HELPERS = '@swc/helpers';
const DTS_EXTENSIONS = [
    'd.ts',
    'd.mts',
    'd.cts'
];
const JS_EXTENSIONS = [
    'js',
    'mjs',
    'jsx',
    '(?<!\\.d\\.)ts',
    '(?<!\\.d\\.)mts',
    '(?<!\\.d\\.)cts',
    'tsx',
    'cjs',
    'cjsx',
    'mjsx',
    'mtsx',
    'ctsx'
];
const CSS_EXTENSIONS = [
    'css',
    'sass',
    'scss',
    'less',
    'styl',
    'stylus'
];
const JS_EXTENSIONS_PATTERN = new RegExp(`\\.(${JS_EXTENSIONS.join('|')})$`);
const CSS_EXTENSIONS_PATTERN = new RegExp(`\\.(${CSS_EXTENSIONS.join('|')})$`);
const DTS_EXTENSIONS_PATTERN = new RegExp(`\\.(${DTS_EXTENSIONS.join('|')})$`);
function getUndoPath(filename, outputPathArg, enforceRelative) {
    let depth = -1;
    let append = '';
    let outputPath = outputPathArg.replace(/[\\/]$/, '');
    for (const part of filename.split(/[/\\]+/))if ('..' === part) if (depth > -1) depth--;
    else {
        const i = outputPath.lastIndexOf('/');
        const j = outputPath.lastIndexOf('\\');
        const pos = i < 0 ? j : j < 0 ? i : Math.max(i, j);
        if (pos < 0) return `${outputPath}/`;
        append = `${outputPath.slice(pos + 1)}/${append}`;
        outputPath = outputPath.slice(0, pos);
    }
    else if ('.' !== part) depth++;
    return depth > 0 ? `${'../'.repeat(depth)}${append}` : enforceRelative ? `./${append}` : append;
}
function isCssFile(filepath) {
    return CSS_EXTENSIONS_PATTERN.test(filepath);
}
const CSS_MODULE_REG = /\.module\.\w+$/i;
const PATH_QUERY_FRAGMENT_REGEXP = /^((?:\u200b.|[^?#\u200b])*)(\?(?:\u200b.|[^#\u200b])*)?(#.*)?$/;
function parsePathQueryFragment(str) {
    const match = PATH_QUERY_FRAGMENT_REGEXP.exec(str);
    return {
        path: match?.[1]?.replace(/\u200b(.)/g, '$1') || '',
        query: match?.[2] ? match[2].replace(/\u200b(.)/g, '$1') : '',
        fragment: match?.[3] || ''
    };
}
function isCssModulesFile(filepath, auto) {
    const filename = node_path.basename(filepath);
    if (true === auto) return CSS_MODULE_REG.test(filename);
    if (auto instanceof RegExp) return auto.test(filepath);
    if ('function' == typeof auto) {
        const { path, query, fragment } = parsePathQueryFragment(filepath);
        return auto(path, query, fragment);
    }
    return false;
}
function isCssGlobalFile(filepath, auto) {
    const isCss = isCssFile(filepath);
    if (!isCss) return false;
    const isCssModules = isCssModulesFile(filepath, auto);
    return !isCssModules;
}
const BASE_URI = 'rspack-css-extract://';
const AUTO_PUBLIC_PATH = '__css_extract_public_path_auto__';
const ABSOLUTE_PUBLIC_PATH = `${BASE_URI}/css-extract-plugin/`;
const SINGLE_DOT_PATH_SEGMENT = '__css_extract_single_dot_path_segment__';
export { ABSOLUTE_PUBLIC_PATH, AUTO_PUBLIC_PATH, BASE_URI, CSS_EXTENSIONS_PATTERN, DTS_EXTENSIONS_PATTERN, JS_EXTENSIONS_PATTERN, SINGLE_DOT_PATH_SEGMENT, SWC_HELPERS, getUndoPath, isCssFile, isCssGlobalFile, isCssModulesFile };
