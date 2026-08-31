import { isCSSModules } from "./349.js";
let pitch = function() {
    let { modules } = this.getOptions();
    if (!isCSSModules(modules, this)) return '';
};
export default function(source) {
    return source.includes('___CSS_LOADER_EXPORT___') ? '' : source;
};
export { pitch };
