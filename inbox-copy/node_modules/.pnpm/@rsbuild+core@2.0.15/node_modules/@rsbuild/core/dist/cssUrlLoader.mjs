import node_path from "node:path";
import { isCSSModules } from "./349.js";
let HASH_PLACEHOLDER_REGEX = /\[(?:[^:\]]+:)?(?:chunkhash|contenthash|hash|fullhash)(?::[^\]]+)?]/i, getRelativePath = (root, resourcePath)=>{
    let relativePath = node_path.relative(root, resourcePath);
    if (relativePath && !('..' === relativePath || relativePath.startsWith(`..${node_path.sep}`)) && !node_path.isAbsolute(relativePath)) return relativePath.replace(/\\/g, '/');
}, pitch = async function(remainingRequest) {
    let root, resourcePath, nameSource, hash, options = this.getOptions();
    if (isCSSModules(options.modules, this)) throw Error('[rsbuild:css] CSS Modules do not support the ?url query. Use ?inline to import the compiled CSS content as a string.');
    let content = ((moduleExports)=>{
        let content = moduleExports && 'object' == typeof moduleExports && 'default' in moduleExports ? moduleExports.default : moduleExports;
        if ('string' != typeof content) throw Error('[rsbuild:css] Expected CSS ?url imports to export a string.');
        return content;
    })(await this.importModule(`!!${remainingRequest}`)), ext = node_path.extname(this.resourcePath), sourceFilename = node_path.relative(this.rootContext, this.resourcePath).replace(/\\/g, '/'), name = (root = this.rootContext, resourcePath = this.resourcePath, nameSource = getRelativePath(node_path.join(root, 'src'), resourcePath) ?? getRelativePath(root, resourcePath) ?? node_path.basename(resourcePath), ext ? nameSource.slice(0, -ext.length) : nameSource), contentHash = ((hash = this.utils.createHash(this._compilation.outputOptions.hashFunction)).update(Buffer.from(content)), hash.digest(this._compilation.outputOptions.hashDigest || 'hex')), pathData = {
        contentHash,
        chunk: {
            name,
            hash: contentHash,
            contentHash: {
                css: contentHash
            }
        }
    }, assetInfo = {
        sourceFilename
    }, filenameTemplate = 'function' == typeof options.filename ? options.filename(pathData, assetInfo) : options.filename, { path: filename, info } = this._compilation.getAssetPathWithInfo(filenameTemplate, pathData);
    return this.emitFile(filename, content, void 0, {
        ...info,
        ...assetInfo,
        immutable: info.immutable || HASH_PLACEHOLDER_REGEX.test(filenameTemplate)
    }), `export default __webpack_public_path__ + ${JSON.stringify(filename)};`;
};
export default function(source) {
    return source;
};
export { pitch };
