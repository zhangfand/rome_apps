/*! LICENSE: connect-next.js.LICENSE.txt */
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import * as __rspack_external_node_http_2dc67212 from "node:http";
let __rspack_createRequire_require = createRequire(import.meta.url);
var __webpack_modules__ = {}, __webpack_module_cache__ = {};
function __nested_rspack_require_364__(moduleId) {
    var cachedModule = __webpack_module_cache__[moduleId];
    if (void 0 !== cachedModule) return cachedModule.exports;
    var module = __webpack_module_cache__[moduleId] = {
        exports: {}
    };
    return __webpack_modules__[moduleId](module, module.exports, __nested_rspack_require_364__), module.exports;
}
__nested_rspack_require_364__.m = __webpack_modules__, __nested_rspack_require_364__.n = (module)=>{
    var getter = module && module.__esModule ? ()=>module.default : ()=>module;
    return __nested_rspack_require_364__.d(getter, {
        a: getter
    }), getter;
}, __nested_rspack_require_364__.d = (exports, getters, values)=>{
    var define = (defs, kind)=>{
        for(var key in defs)__nested_rspack_require_364__.o(defs, key) && !__nested_rspack_require_364__.o(exports, key) && Object.defineProperty(exports, key, {
            enumerable: !0,
            [kind]: defs[key]
        });
    };
    define(getters, "get"), define(values, "value");
}, __nested_rspack_require_364__.add = function(modules) {
    Object.assign(__nested_rspack_require_364__.m, modules);
}, __nested_rspack_require_364__.o = (obj, prop)=>Object.prototype.hasOwnProperty.call(obj, prop), __nested_rspack_require_364__.add({
    "./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/browser.js" (module, exports, __nested_rspack_require_1796_1815__) {
        let warned;
        function useColors() {
            let m;
            return "u" > typeof window && !!window.process && ('renderer' === window.process.type || !!window.process.__nwjs) || !("u" > typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) && ("u" > typeof document && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || "u" > typeof window && window.console && (window.console.firebug || window.console.exception && window.console.table) || "u" > typeof navigator && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || "u" > typeof navigator && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
        }
        function formatArgs(args) {
            if (args[0] = (this.useColors ? '%c' : '') + this.namespace + (this.useColors ? ' %c' : ' ') + args[0] + (this.useColors ? '%c ' : ' ') + '+' + module.exports.humanize(this.diff), !this.useColors) return;
            let c = 'color: ' + this.color;
            args.splice(1, 0, c, 'color: inherit');
            let index = 0, lastC = 0;
            args[0].replace(/%[a-zA-Z%]/g, (match)=>{
                '%%' !== match && (index++, '%c' === match && (lastC = index));
            }), args.splice(lastC, 0, c);
        }
        function save(namespaces) {
            try {
                namespaces ? exports.storage.setItem('debug', namespaces) : exports.storage.removeItem('debug');
            } catch (error) {}
        }
        function load() {
            let r;
            try {
                r = exports.storage.getItem('debug') || exports.storage.getItem('DEBUG');
            } catch (error) {}
            return !r && "u" > typeof process && 'env' in process && (r = process.env.DEBUG), r;
        }
        function localstorage() {
            try {
                return localStorage;
            } catch (error) {}
        }
        exports.formatArgs = formatArgs, exports.save = save, exports.load = load, exports.useColors = useColors, exports.storage = localstorage(), warned = !1, exports.destroy = ()=>{
            warned || (warned = !0, console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'));
        }, exports.colors = [
            '#0000CC',
            '#0000FF',
            '#0033CC',
            '#0033FF',
            '#0066CC',
            '#0066FF',
            '#0099CC',
            '#0099FF',
            '#00CC00',
            '#00CC33',
            '#00CC66',
            '#00CC99',
            '#00CCCC',
            '#00CCFF',
            '#3300CC',
            '#3300FF',
            '#3333CC',
            '#3333FF',
            '#3366CC',
            '#3366FF',
            '#3399CC',
            '#3399FF',
            '#33CC00',
            '#33CC33',
            '#33CC66',
            '#33CC99',
            '#33CCCC',
            '#33CCFF',
            '#6600CC',
            '#6600FF',
            '#6633CC',
            '#6633FF',
            '#66CC00',
            '#66CC33',
            '#9900CC',
            '#9900FF',
            '#9933CC',
            '#9933FF',
            '#99CC00',
            '#99CC33',
            '#CC0000',
            '#CC0033',
            '#CC0066',
            '#CC0099',
            '#CC00CC',
            '#CC00FF',
            '#CC3300',
            '#CC3333',
            '#CC3366',
            '#CC3399',
            '#CC33CC',
            '#CC33FF',
            '#CC6600',
            '#CC6633',
            '#CC9900',
            '#CC9933',
            '#CCCC00',
            '#CCCC33',
            '#FF0000',
            '#FF0033',
            '#FF0066',
            '#FF0099',
            '#FF00CC',
            '#FF00FF',
            '#FF3300',
            '#FF3333',
            '#FF3366',
            '#FF3399',
            '#FF33CC',
            '#FF33FF',
            '#FF6600',
            '#FF6633',
            '#FF9900',
            '#FF9933',
            '#FFCC00',
            '#FFCC33'
        ], exports.log = console.debug || console.log || (()=>{}), module.exports = __nested_rspack_require_1796_1815__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/common.js")(exports);
        let { formatters } = module.exports;
        formatters.j = function(v) {
            try {
                return JSON.stringify(v);
            } catch (error) {
                return '[UnexpectedJSONParseError]: ' + error.message;
            }
        };
    },
    "./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/common.js" (module, __unused_rspack_exports, __nested_rspack_require_6962_6981__) {
        module.exports = function setup(env) {
            function selectColor(namespace) {
                let hash = 0;
                for(let i = 0; i < namespace.length; i++)hash = (hash << 5) - hash + namespace.charCodeAt(i) | 0;
                return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
            }
            function createDebug(namespace) {
                let prevTime, namespacesCache, enabledCache, enableOverride = null;
                function debug(...args) {
                    if (!debug.enabled) return;
                    let self = debug, curr = Number(new Date());
                    self.diff = curr - (prevTime || curr), self.prev = prevTime, self.curr = curr, prevTime = curr, args[0] = createDebug.coerce(args[0]), 'string' != typeof args[0] && args.unshift('%O');
                    let index = 0;
                    args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format)=>{
                        if ('%%' === match) return '%';
                        index++;
                        let formatter = createDebug.formatters[format];
                        if ('function' == typeof formatter) {
                            let val = args[index];
                            match = formatter.call(self, val), args.splice(index, 1), index--;
                        }
                        return match;
                    }), createDebug.formatArgs.call(self, args), (self.log || createDebug.log).apply(self, args);
                }
                return debug.namespace = namespace, debug.useColors = createDebug.useColors(), debug.color = createDebug.selectColor(namespace), debug.extend = extend, debug.destroy = createDebug.destroy, Object.defineProperty(debug, 'enabled', {
                    enumerable: !0,
                    configurable: !1,
                    get: ()=>null !== enableOverride ? enableOverride : (namespacesCache !== createDebug.namespaces && (namespacesCache = createDebug.namespaces, enabledCache = createDebug.enabled(namespace)), enabledCache),
                    set: (v)=>{
                        enableOverride = v;
                    }
                }), 'function' == typeof createDebug.init && createDebug.init(debug), debug;
            }
            function extend(namespace, delimiter) {
                let newDebug = createDebug(this.namespace + (void 0 === delimiter ? ':' : delimiter) + namespace);
                return newDebug.log = this.log, newDebug;
            }
            function enable(namespaces) {
                for (let ns of (createDebug.save(namespaces), createDebug.namespaces = namespaces, createDebug.names = [], createDebug.skips = [], ('string' == typeof namespaces ? namespaces : '').trim().replace(/\s+/g, ',').split(',').filter(Boolean)))'-' === ns[0] ? createDebug.skips.push(ns.slice(1)) : createDebug.names.push(ns);
            }
            function matchesTemplate(search, template) {
                let searchIndex = 0, templateIndex = 0, starIndex = -1, matchIndex = 0;
                for(; searchIndex < search.length;)if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || '*' === template[templateIndex])) '*' === template[templateIndex] ? (starIndex = templateIndex, matchIndex = searchIndex) : searchIndex++, templateIndex++;
                else {
                    if (-1 === starIndex) return !1;
                    templateIndex = starIndex + 1, searchIndex = ++matchIndex;
                }
                for(; templateIndex < template.length && '*' === template[templateIndex];)templateIndex++;
                return templateIndex === template.length;
            }
            function disable() {
                let namespaces = [
                    ...createDebug.names,
                    ...createDebug.skips.map((namespace)=>'-' + namespace)
                ].join(',');
                return createDebug.enable(''), namespaces;
            }
            function enabled(name) {
                for (let skip of createDebug.skips)if (matchesTemplate(name, skip)) return !1;
                for (let ns of createDebug.names)if (matchesTemplate(name, ns)) return !0;
                return !1;
            }
            function coerce(val) {
                return val instanceof Error ? val.stack || val.message : val;
            }
            function destroy() {
                console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
            }
            return createDebug.debug = createDebug, createDebug.default = createDebug, createDebug.coerce = coerce, createDebug.disable = disable, createDebug.enable = enable, createDebug.enabled = enabled, createDebug.humanize = __nested_rspack_require_6962_6981__("./node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"), createDebug.destroy = destroy, Object.keys(env).forEach((key)=>{
                createDebug[key] = env[key];
            }), createDebug.names = [], createDebug.skips = [], createDebug.formatters = {}, createDebug.selectColor = selectColor, createDebug.enable(createDebug.load()), createDebug;
        };
    },
    "./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/index.js" (module, __unused_rspack_exports, __nested_rspack_require_13710_13729__) {
        "u" < typeof process || 'renderer' === process.type || !0 === process.browser || process.__nwjs ? module.exports = __nested_rspack_require_13710_13729__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/browser.js") : module.exports = __nested_rspack_require_13710_13729__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/node.js");
    },
    "./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/node.js" (module, exports, __nested_rspack_require_14228_14247__) {
        let tty = __nested_rspack_require_14228_14247__("tty"), util = __nested_rspack_require_14228_14247__("util");
        exports.init = init, exports.log = log, exports.formatArgs = formatArgs, exports.save = save, exports.load = load, exports.useColors = useColors, exports.destroy = util.deprecate(()=>{}, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'), exports.colors = [
            6,
            2,
            3,
            4,
            5,
            1
        ];
        try {
            let supportsColor = __nested_rspack_require_14228_14247__("./node_modules/.pnpm/supports-color@8.1.1/node_modules/supports-color/index.js");
            supportsColor && (supportsColor.stderr || supportsColor).level >= 2 && (exports.colors = [
                20,
                21,
                26,
                27,
                32,
                33,
                38,
                39,
                40,
                41,
                42,
                43,
                44,
                45,
                56,
                57,
                62,
                63,
                68,
                69,
                74,
                75,
                76,
                77,
                78,
                79,
                80,
                81,
                92,
                93,
                98,
                99,
                112,
                113,
                128,
                129,
                134,
                135,
                148,
                149,
                160,
                161,
                162,
                163,
                164,
                165,
                166,
                167,
                168,
                169,
                170,
                171,
                172,
                173,
                178,
                179,
                184,
                185,
                196,
                197,
                198,
                199,
                200,
                201,
                202,
                203,
                204,
                205,
                206,
                207,
                208,
                209,
                214,
                215,
                220,
                221
            ]);
        } catch (error) {}
        function useColors() {
            return 'colors' in exports.inspectOpts ? !!exports.inspectOpts.colors : tty.isatty(process.stderr.fd);
        }
        function formatArgs(args) {
            let { namespace: name, useColors } = this;
            if (useColors) {
                let c = this.color, colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c), prefix = `  ${colorCode};1m${name} \u001B[0m`;
                args[0] = prefix + args[0].split('\n').join('\n' + prefix), args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
            } else args[0] = getDate() + name + ' ' + args[0];
        }
        function getDate() {
            return exports.inspectOpts.hideDate ? '' : new Date().toISOString() + ' ';
        }
        function log(...args) {
            return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
        }
        function save(namespaces) {
            namespaces ? process.env.DEBUG = namespaces : delete process.env.DEBUG;
        }
        function load() {
            return process.env.DEBUG;
        }
        function init(debug) {
            debug.inspectOpts = {};
            let keys = Object.keys(exports.inspectOpts);
            for(let i = 0; i < keys.length; i++)debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
        }
        exports.inspectOpts = Object.keys(process.env).filter((key)=>/^debug_/i.test(key)).reduce((obj, key)=>{
            let prop = key.substring(6).toLowerCase().replace(/_([a-z])/g, (_, k)=>k.toUpperCase()), val = process.env[key];
            return val = !!/^(yes|on|true|enabled)$/i.test(val) || !/^(no|off|false|disabled)$/i.test(val) && ('null' === val ? null : Number(val)), obj[prop] = val, obj;
        }, {}), module.exports = __nested_rspack_require_14228_14247__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/common.js")(exports);
        let { formatters } = module.exports;
        formatters.o = function(v) {
            return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts).split('\n').map((str)=>str.trim()).join(' ');
        }, formatters.O = function(v) {
            return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts);
        };
    },
    "./node_modules/.pnpm/ee-first@1.1.1/node_modules/ee-first/index.js" (module) {
        function listener(event, done) {
            return function(arg1) {
                for(var args = Array(arguments.length), i = 0; i < args.length; i++)args[i] = arguments[i];
                done('error' === event ? arg1 : null, this, event, args);
            };
        }
        module.exports = function first(stuff, done) {
            if (!Array.isArray(stuff)) throw TypeError('arg must be an array of [ee, events...] arrays');
            for(var cleanups = [], i = 0; i < stuff.length; i++){
                var arr = stuff[i];
                if (!Array.isArray(arr) || arr.length < 2) throw TypeError('each array member must be [ee, events...]');
                for(var ee = arr[0], j = 1; j < arr.length; j++){
                    var event = arr[j], fn = listener(event, callback);
                    ee.on(event, fn), cleanups.push({
                        ee: ee,
                        event: event,
                        fn: fn
                    });
                }
            }
            function callback() {
                cleanup(), done.apply(null, arguments);
            }
            function cleanup() {
                for(var x, i = 0; i < cleanups.length; i++)(x = cleanups[i]).ee.removeListener(x.event, x.fn);
            }
            function thunk(fn) {
                done = fn;
            }
            return thunk.cancel = cleanup, thunk;
        };
    },
    "./node_modules/.pnpm/encodeurl@2.0.0/node_modules/encodeurl/index.js" (module) {
        module.exports = encodeUrl;
        var ENCODE_CHARS_REGEXP = /(?:[^\x21\x23-\x3B\x3D\x3F-\x5F\x61-\x7A\x7C\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g, UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
        function encodeUrl(url) {
            return String(url).replace(UNMATCHED_SURROGATE_PAIR_REGEXP, '$1\uFFFD$2').replace(ENCODE_CHARS_REGEXP, encodeURI);
        }
    },
    "./node_modules/.pnpm/escape-html@1.0.3/node_modules/escape-html/index.js" (module) {
        var matchHtmlRegExp = /["'&<>]/;
        module.exports = function escapeHtml(string) {
            var escape, str = '' + string, match = matchHtmlRegExp.exec(str);
            if (!match) return str;
            var html = '', index = 0, lastIndex = 0;
            for(index = match.index; index < str.length; index++){
                switch(str.charCodeAt(index)){
                    case 34:
                        escape = '&quot;';
                        break;
                    case 38:
                        escape = '&amp;';
                        break;
                    case 39:
                        escape = '&#39;';
                        break;
                    case 60:
                        escape = '&lt;';
                        break;
                    case 62:
                        escape = '&gt;';
                        break;
                    default:
                        continue;
                }
                lastIndex !== index && (html += str.substring(lastIndex, index)), lastIndex = index + 1, html += escape;
            }
            return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
        };
    },
    "./node_modules/.pnpm/finalhandler@2.1.1/node_modules/finalhandler/index.js" (module, __unused_rspack_exports, __nested_rspack_require_23493_23512__) {
        var debug = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/index.js")('finalhandler'), encodeUrl = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/encodeurl@2.0.0/node_modules/encodeurl/index.js"), escapeHtml = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/escape-html@1.0.3/node_modules/escape-html/index.js"), onFinished = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/on-finished@2.4.1/node_modules/on-finished/index.js"), parseUrl = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/parseurl@1.3.3/node_modules/parseurl/index.js"), statuses = __nested_rspack_require_23493_23512__("./node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/index.js"), isFinished = onFinished.isFinished;
        function createHtmlDocument(message) {
            return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>' + escapeHtml(message).replaceAll('\n', '<br>').replaceAll('  ', ' &nbsp;') + "</pre>\n</body>\n</html>\n";
        }
        function getErrorHeaders(err) {
            if (err.headers && 'object' == typeof err.headers) return {
                ...err.headers
            };
        }
        function getErrorMessage(err, status, env) {
            var msg;
            return 'production' !== env && ((msg = err.stack) || 'function' != typeof err.toString || (msg = err.toString())), msg || statuses.message[status];
        }
        function getErrorStatusCode(err) {
            return 'number' == typeof err.status && err.status >= 400 && err.status < 600 ? err.status : 'number' == typeof err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : void 0;
        }
        function getResourceName(req) {
            try {
                return parseUrl.original(req).pathname;
            } catch (e) {
                return 'resource';
            }
        }
        function getResponseStatusCode(res) {
            var status = res.statusCode;
            return ('number' != typeof status || status < 400 || status > 599) && (status = 500), status;
        }
        function send(req, res, status, headers, message) {
            function write() {
                var body = createHtmlDocument(message);
                for (let [key, value] of (res.statusCode = status, req.httpVersionMajor < 2 && (res.statusMessage = statuses.message[status]), res.removeHeader('Content-Encoding'), res.removeHeader('Content-Language'), res.removeHeader('Content-Range'), Object.entries(headers ?? {})))res.setHeader(key, value);
                (res.setHeader('Content-Security-Policy', "default-src 'none'"), res.setHeader('X-Content-Type-Options', 'nosniff'), res.setHeader('Content-Type', 'text/html; charset=utf-8'), res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8')), 'HEAD' === req.method) ? res.end() : res.end(body, 'utf8');
            }
            isFinished(req) ? write() : (req.unpipe(), onFinished(req, write), req.resume());
        }
        module.exports = function finalhandler(req, res, options) {
            var opts = options || {}, env = opts.env || process.env.NODE_ENV || 'development', onerror = opts.onerror;
            return function(err) {
                var headers, msg, status;
                if (!err && res.headersSent) return void debug('cannot 404 after headers sent');
                if (err ? (void 0 === (status = getErrorStatusCode(err)) ? status = getResponseStatusCode(res) : headers = getErrorHeaders(err), msg = getErrorMessage(err, status, env)) : (status = 404, msg = 'Cannot ' + req.method + ' ' + encodeUrl(getResourceName(req))), debug('default %s', status), err && onerror && setImmediate(onerror, err, req, res), res.headersSent) {
                    debug('cannot %d after headers sent', status), req.socket && req.socket.destroy();
                    return;
                }
                send(req, res, status, headers, msg);
            };
        };
    },
    "./node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js" (module) {
        module.exports = (flag, argv = process.argv)=>{
            let prefix = flag.startsWith('-') ? '' : 1 === flag.length ? '-' : '--', position = argv.indexOf(prefix + flag), terminatorPosition = argv.indexOf('--');
            return -1 !== position && (-1 === terminatorPosition || position < terminatorPosition);
        };
    },
    "./node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js" (module) {
        function parse(str) {
            if (!((str = String(str)).length > 100)) {
                var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
                if (match) {
                    var n = parseFloat(match[1]);
                    switch((match[2] || 'ms').toLowerCase()){
                        case 'years':
                        case 'year':
                        case 'yrs':
                        case 'yr':
                        case 'y':
                            return 31557600000 * n;
                        case 'weeks':
                        case 'week':
                        case 'w':
                            return 604800000 * n;
                        case 'days':
                        case 'day':
                        case 'd':
                            return 86400000 * n;
                        case 'hours':
                        case 'hour':
                        case 'hrs':
                        case 'hr':
                        case 'h':
                            return 3600000 * n;
                        case 'minutes':
                        case 'minute':
                        case 'mins':
                        case 'min':
                        case 'm':
                            return 60000 * n;
                        case 'seconds':
                        case 'second':
                        case 'secs':
                        case 'sec':
                        case 's':
                            return 1000 * n;
                        case 'milliseconds':
                        case 'millisecond':
                        case 'msecs':
                        case 'msec':
                        case 'ms':
                            return n;
                        default:
                            return;
                    }
                }
            }
        }
        function fmtShort(ms) {
            var msAbs = Math.abs(ms);
            return msAbs >= 86400000 ? Math.round(ms / 86400000) + 'd' : msAbs >= 3600000 ? Math.round(ms / 3600000) + 'h' : msAbs >= 60000 ? Math.round(ms / 60000) + 'm' : msAbs >= 1000 ? Math.round(ms / 1000) + 's' : ms + 'ms';
        }
        function fmtLong(ms) {
            var msAbs = Math.abs(ms);
            return msAbs >= 86400000 ? plural(ms, msAbs, 86400000, 'day') : msAbs >= 3600000 ? plural(ms, msAbs, 3600000, 'hour') : msAbs >= 60000 ? plural(ms, msAbs, 60000, 'minute') : msAbs >= 1000 ? plural(ms, msAbs, 1000, 'second') : ms + ' ms';
        }
        function plural(ms, msAbs, n, name) {
            return Math.round(ms / n) + ' ' + name + (msAbs >= 1.5 * n ? 's' : '');
        }
        module.exports = function(val, options) {
            options = options || {};
            var type = typeof val;
            if ('string' === type && val.length > 0) return parse(val);
            if ('number' === type && isFinite(val)) return options.long ? fmtLong(val) : fmtShort(val);
            throw Error('val is not a non-empty string or a valid number. val=' + JSON.stringify(val));
        };
    },
    "./node_modules/.pnpm/on-finished@2.4.1/node_modules/on-finished/index.js" (module, __unused_rspack_exports, __nested_rspack_require_32097_32116__) {
        module.exports = onFinished, module.exports.isFinished = isFinished;
        var asyncHooks = tryRequireAsyncHooks(), first = __nested_rspack_require_32097_32116__("./node_modules/.pnpm/ee-first@1.1.1/node_modules/ee-first/index.js"), defer = 'function' == typeof setImmediate ? setImmediate : function(fn) {
            process.nextTick(fn.bind.apply(fn, arguments));
        };
        function onFinished(msg, listener) {
            return !1 !== isFinished(msg) ? defer(listener, null, msg) : attachListener(msg, wrap(listener)), msg;
        }
        function isFinished(msg) {
            var socket = msg.socket;
            return 'boolean' == typeof msg.finished ? !!(msg.finished || socket && !socket.writable) : 'boolean' == typeof msg.complete ? !!(msg.upgrade || !socket || !socket.readable || msg.complete && !msg.readable) : void 0;
        }
        function attachFinishedListener(msg, callback) {
            var eeMsg, eeSocket, finished = !1;
            function onFinish(error) {
                eeMsg.cancel(), eeSocket.cancel(), finished = !0, callback(error);
            }
            function onSocket(socket) {
                msg.removeListener('socket', onSocket), finished || eeMsg === eeSocket && (eeSocket = first([
                    [
                        socket,
                        'error',
                        'close'
                    ]
                ], onFinish));
            }
            (eeMsg = eeSocket = first([
                [
                    msg,
                    'end',
                    'finish'
                ]
            ], onFinish), msg.socket) ? onSocket(msg.socket) : (msg.on('socket', onSocket), void 0 === msg.socket && patchAssignSocket(msg, onSocket));
        }
        function attachListener(msg, listener) {
            var attached = msg.__onFinished;
            attached && attached.queue || (attached = msg.__onFinished = createListener(msg), attachFinishedListener(msg, attached)), attached.queue.push(listener);
        }
        function createListener(msg) {
            function listener(err) {
                if (msg.__onFinished === listener && (msg.__onFinished = null), listener.queue) {
                    var queue = listener.queue;
                    listener.queue = null;
                    for(var i = 0; i < queue.length; i++)queue[i](err, msg);
                }
            }
            return listener.queue = [], listener;
        }
        function patchAssignSocket(res, callback) {
            var assignSocket = res.assignSocket;
            'function' == typeof assignSocket && (res.assignSocket = function(socket) {
                assignSocket.call(this, socket), callback(socket);
            });
        }
        function tryRequireAsyncHooks() {
            try {
                return __nested_rspack_require_32097_32116__("async_hooks");
            } catch (e) {
                return {};
            }
        }
        function wrap(fn) {
            var res;
            return (asyncHooks.AsyncResource && (res = new asyncHooks.AsyncResource(fn.name || 'bound-anonymous-fn')), res && res.runInAsyncScope) ? res.runInAsyncScope.bind(res, fn, null) : fn;
        }
    },
    "./node_modules/.pnpm/parseurl@1.3.3/node_modules/parseurl/index.js" (module, __unused_rspack_exports, __nested_rspack_require_36017_36036__) {
        var url = __nested_rspack_require_36017_36036__("url"), parse = url.parse, Url = url.Url;
        function parseurl(req) {
            var url = req.url;
            if (void 0 !== url) {
                var parsed = req._parsedUrl;
                return fresh(url, parsed) ? parsed : ((parsed = fastparse(url))._raw = url, req._parsedUrl = parsed);
            }
        }
        function originalurl(req) {
            var url = req.originalUrl;
            if ('string' != typeof url) return parseurl(req);
            var parsed = req._parsedOriginalUrl;
            return fresh(url, parsed) ? parsed : ((parsed = fastparse(url))._raw = url, req._parsedOriginalUrl = parsed);
        }
        function fastparse(str) {
            if ('string' != typeof str || 0x2f !== str.charCodeAt(0)) return parse(str);
            for(var pathname = str, query = null, search = null, i = 1; i < str.length; i++)switch(str.charCodeAt(i)){
                case 0x3f:
                    null === search && (pathname = str.substring(0, i), query = str.substring(i + 1), search = str.substring(i));
                    break;
                case 0x09:
                case 0x0a:
                case 0x0c:
                case 0x0d:
                case 0x20:
                case 0x23:
                case 0xa0:
                case 0xfeff:
                    return parse(str);
            }
            var url = void 0 !== Url ? new Url() : {};
            return url.path = str, url.href = str, url.pathname = pathname, null !== search && (url.query = query, url.search = search), url;
        }
        function fresh(url, parsedUrl) {
            return 'object' == typeof parsedUrl && null !== parsedUrl && (void 0 === Url || parsedUrl instanceof Url) && parsedUrl._raw === url;
        }
        module.exports = parseurl, module.exports.original = originalurl;
    },
    "./node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/index.js" (module, __unused_rspack_exports, __nested_rspack_require_38488_38507__) {
        var codes = __nested_rspack_require_38488_38507__("./node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/codes.json");
        function createMessageToStatusCodeMap(codes) {
            var map = {};
            return Object.keys(codes).forEach(function(code) {
                var message = codes[code], status = Number(code);
                map[message.toLowerCase()] = status;
            }), map;
        }
        function createStatusCodeList(codes) {
            return Object.keys(codes).map(function(code) {
                return Number(code);
            });
        }
        function getStatusCode(message) {
            var msg = message.toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(status.code, msg)) throw Error('invalid status message: "' + message + '"');
            return status.code[msg];
        }
        function getStatusMessage(code) {
            if (!Object.prototype.hasOwnProperty.call(status.message, code)) throw Error('invalid status code: ' + code);
            return status.message[code];
        }
        function status(code) {
            if ('number' == typeof code) return getStatusMessage(code);
            if ('string' != typeof code) throw TypeError('code must be a number or string');
            var n = parseInt(code, 10);
            return isNaN(n) ? getStatusCode(code) : getStatusMessage(n);
        }
        module.exports = status, status.message = codes, status.code = createMessageToStatusCodeMap(codes), status.codes = createStatusCodeList(codes), status.redirect = {
            300: !0,
            301: !0,
            302: !0,
            303: !0,
            305: !0,
            307: !0,
            308: !0
        }, status.empty = {
            204: !0,
            205: !0,
            304: !0
        }, status.retry = {
            502: !0,
            503: !0,
            504: !0
        };
    },
    "./node_modules/.pnpm/supports-color@8.1.1/node_modules/supports-color/index.js" (module, __unused_rspack_exports, __nested_rspack_require_40780_40799__) {
        let flagForceColor, os = __nested_rspack_require_40780_40799__("os"), tty = __nested_rspack_require_40780_40799__("tty"), hasFlag = __nested_rspack_require_40780_40799__("./node_modules/.pnpm/has-flag@4.0.0/node_modules/has-flag/index.js"), { env } = process;
        function envForceColor() {
            if ('FORCE_COLOR' in env) return 'true' === env.FORCE_COLOR ? 1 : 'false' === env.FORCE_COLOR ? 0 : 0 === env.FORCE_COLOR.length ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
        }
        function translateLevel(level) {
            return 0 !== level && {
                level,
                hasBasic: !0,
                has256: level >= 2,
                has16m: level >= 3
            };
        }
        function supportsColor(haveStream, { streamIsTTY, sniffFlags = !0 } = {}) {
            let noFlagForceColor = envForceColor();
            void 0 !== noFlagForceColor && (flagForceColor = noFlagForceColor);
            let forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
            if (0 === forceColor) return 0;
            if (sniffFlags) {
                if (hasFlag('color=16m') || hasFlag('color=full') || hasFlag('color=truecolor')) return 3;
                if (hasFlag('color=256')) return 2;
            }
            if (haveStream && !streamIsTTY && void 0 === forceColor) return 0;
            let min = forceColor || 0;
            if ('dumb' === env.TERM) return min;
            if ('win32' === process.platform) {
                let osRelease = os.release().split('.');
                return Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586 ? Number(osRelease[2]) >= 14931 ? 3 : 2 : 1;
            }
            if ('CI' in env) return [
                'TRAVIS',
                'CIRCLECI',
                'APPVEYOR',
                'GITLAB_CI',
                'GITHUB_ACTIONS',
                'BUILDKITE',
                'DRONE'
            ].some((sign)=>sign in env) || 'codeship' === env.CI_NAME ? 1 : min;
            if ('TEAMCITY_VERSION' in env) return +!!/^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION);
            if ('truecolor' === env.COLORTERM) return 3;
            if ('TERM_PROGRAM' in env) {
                let version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
                switch(env.TERM_PROGRAM){
                    case 'iTerm.app':
                        return version >= 3 ? 3 : 2;
                    case 'Apple_Terminal':
                        return 2;
                }
            }
            return /-256(color)?$/i.test(env.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM) || 'COLORTERM' in env ? 1 : min;
        }
        function getSupportLevel(stream, options = {}) {
            return translateLevel(supportsColor(stream, {
                streamIsTTY: stream && stream.isTTY,
                ...options
            }));
        }
        hasFlag('no-color') || hasFlag('no-colors') || hasFlag('color=false') || hasFlag('color=never') ? flagForceColor = 0 : (hasFlag('color') || hasFlag('colors') || hasFlag('color=true') || hasFlag('color=always')) && (flagForceColor = 1), module.exports = {
            supportsColor: getSupportLevel,
            stdout: getSupportLevel({
                isTTY: tty.isatty(1)
            }),
            stderr: getSupportLevel({
                isTTY: tty.isatty(2)
            })
        };
    },
    async_hooks (module) {
        module.exports = __rspack_createRequire_require("async_hooks");
    },
    os (module) {
        module.exports = __rspack_createRequire_require("os");
    },
    tty (module) {
        module.exports = __rspack_createRequire_require("tty");
    },
    url (module) {
        module.exports = __rspack_createRequire_require("url");
    },
    util (module) {
        module.exports = __rspack_createRequire_require("util");
    },
    "./node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/codes.json" (module) {
        module.exports = JSON.parse('{"100":"Continue","101":"Switching Protocols","102":"Processing","103":"Early Hints","200":"OK","201":"Created","202":"Accepted","203":"Non-Authoritative Information","204":"No Content","205":"Reset Content","206":"Partial Content","207":"Multi-Status","208":"Already Reported","226":"IM Used","300":"Multiple Choices","301":"Moved Permanently","302":"Found","303":"See Other","304":"Not Modified","305":"Use Proxy","307":"Temporary Redirect","308":"Permanent Redirect","400":"Bad Request","401":"Unauthorized","402":"Payment Required","403":"Forbidden","404":"Not Found","405":"Method Not Allowed","406":"Not Acceptable","407":"Proxy Authentication Required","408":"Request Timeout","409":"Conflict","410":"Gone","411":"Length Required","412":"Precondition Failed","413":"Payload Too Large","414":"URI Too Long","415":"Unsupported Media Type","416":"Range Not Satisfiable","417":"Expectation Failed","418":"I\'m a Teapot","421":"Misdirected Request","422":"Unprocessable Entity","423":"Locked","424":"Failed Dependency","425":"Too Early","426":"Upgrade Required","428":"Precondition Required","429":"Too Many Requests","431":"Request Header Fields Too Large","451":"Unavailable For Legal Reasons","500":"Internal Server Error","501":"Not Implemented","502":"Bad Gateway","503":"Service Unavailable","504":"Gateway Timeout","505":"HTTP Version Not Supported","506":"Variant Also Negotiates","507":"Insufficient Storage","508":"Loop Detected","509":"Bandwidth Limit Exceeded","510":"Not Extended","511":"Network Authentication Required"}');
    }
});
let src = __nested_rspack_require_364__("./node_modules/.pnpm/debug@4.4.3_supports-color@8.1.1/node_modules/debug/src/index.js");
var src_default = __nested_rspack_require_364__.n(src);
let dist_finalhandler = __nested_rspack_require_364__("./node_modules/.pnpm/finalhandler@2.1.1/node_modules/finalhandler/index.js");
var finalhandler_default = __nested_rspack_require_364__.n(dist_finalhandler);
let dist_parseurl = __nested_rspack_require_364__("./node_modules/.pnpm/parseurl@1.3.3/node_modules/parseurl/index.js");
var parseurl_default = __nested_rspack_require_364__.n(dist_parseurl);
let dist_debug = src_default()('connect:dispatcher'), dist_env = process.env.NODE_ENV || 'development', dist_defer = setImmediate;
function connect() {
    let app = function(req, res, next) {
        app.handle(req, res, next);
    };
    return Object.assign(app, proto), Object.assign(app, EventEmitter.prototype), app.route = '/', app.stack = [], app;
}
let proto = {
    use (route, fn) {
        let handle = fn, path = '/';
        if ('string' == typeof route ? path = route : handle = route, void 0 === handle) throw TypeError('app.use() requires a middleware function');
        if (isConnectServer(handle)) {
            let server = handle;
            server.route = path, handle = function(req, res, next) {
                server.handle(req, res, next);
            };
        }
        if (isHttpServer(handle)) {
            let requestListener = handle.listeners('request')[0];
            if ('function' != typeof requestListener) throw TypeError('http.Server has no request listener');
            handle = requestListener;
        }
        if (!isConnectHandle(handle)) throw TypeError('app.use() requires a middleware function');
        return path.endsWith('/') && (path = path.slice(0, -1)), dist_debug('use %s %s', path || '/', handle.name || 'anonymous'), this.stack.push({
            route: path,
            handle
        }), this;
    },
    handle (req, res, out) {
        let index = 0, protohost = getProtohost(req.url || '') || '', removed = '', slashAdded = !1, stack = this.stack, done = out ?? finalhandler_default()(req, res, {
            env: dist_env,
            onerror: logerror
        });
        function next(err) {
            slashAdded && (req.url = (req.url || '').slice(1), slashAdded = !1), 0 !== removed.length && (req.url = protohost + removed + (req.url || '').slice(protohost.length), removed = '');
            let layer = stack[index++];
            if (!layer) return void dist_defer(done, err);
            let path = parseurl_default()(req)?.pathname || '/', route = layer.route, lowerPath = path.toLowerCase(), lowerRoute = route.toLowerCase();
            if (!lowerPath.startsWith(lowerRoute)) return void next(err);
            let c = path.length > route.length ? path.charAt(route.length) : '';
            '' !== c && '/' !== c && '.' !== c ? next(err) : (0 !== route.length && '/' !== route && (removed = route, req.url = protohost + (req.url || '').slice(protohost.length + removed.length), protohost || '/' === (req.url || '').charAt(0) || (req.url = '/' + (req.url || ''), slashAdded = !0)), call(layer.handle, route, err, req, res, next));
        }
        req.originalUrl = req.originalUrl || req.url, next();
    },
    listen (...args) {
        return __rspack_external_node_http_2dc67212.createServer(this).listen(...args);
    }
};
function call(handle, route, err, req, res, next) {
    let arity = handle.length, error = err, hasError = void 0 !== err;
    dist_debug('%s %s : %s', handle.name || '<anonymous>', route, req.originalUrl);
    try {
        if (hasError && 4 === arity) return void handle(err, req, res, next);
        if (!hasError && arity < 4) return void handle(req, res, next);
    } catch (caughtError) {
        error = caughtError;
    }
    next(error);
}
function logerror(err) {
    if ('test' !== dist_env) {
        if (err instanceof Error) return void console.error(err.stack || err.toString());
        console.error(String(err));
    }
}
function getProtohost(url) {
    if (0 === url.length || '/' === url[0]) return;
    let fqdnIndex = url.indexOf('://');
    return -1 !== fqdnIndex && -1 === url.lastIndexOf('?', fqdnIndex) ? url.slice(0, url.indexOf('/', 3 + fqdnIndex)) : void 0;
}
function isConnectHandle(value) {
    return 'function' == typeof value;
}
function isConnectServer(value) {
    return 'function' == typeof value && 'handle' in value && 'function' == typeof value.handle;
}
function isHttpServer(value) {
    return value instanceof __rspack_external_node_http_2dc67212.Server;
}
export { connect };
