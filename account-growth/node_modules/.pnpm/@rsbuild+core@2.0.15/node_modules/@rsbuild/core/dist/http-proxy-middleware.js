/*! LICENSE: http-proxy-middleware.js.LICENSE.txt */
import node_http from "node:http";
import node_https from "node:https";
import node_http2 from "node:http2";
import { EventEmitter } from "node:events";
import "node:net";
import "node:stream";
import { URL as external_node_url_URL } from "node:url";
import { URL as external_url_URL } from "url";
import "node:zlib";
import "node:querystring";
import { __webpack_require__ } from "./1~rslib-runtime.js";
import "./756.js";
__webpack_require__.add({
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        let stringify = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/stringify.js"), compile = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/compile.js"), expand = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/expand.js"), parse = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/parse.js"), braces = (input, options = {})=>{
            let output = [];
            if (Array.isArray(input)) for (let pattern of input){
                let result = braces.create(pattern, options);
                Array.isArray(result) ? output.push(...result) : output.push(result);
            }
            else output = [].concat(braces.create(input, options));
            return options && !0 === options.expand && !0 === options.nodupes && (output = [
                ...new Set(output)
            ]), output;
        };
        braces.parse = (input, options = {})=>parse(input, options), braces.stringify = (input, options = {})=>'string' == typeof input ? stringify(braces.parse(input, options), options) : stringify(input, options), braces.compile = (input, options = {})=>('string' == typeof input && (input = braces.parse(input, options)), compile(input, options)), braces.expand = (input, options = {})=>{
            'string' == typeof input && (input = braces.parse(input, options));
            let result = expand(input, options);
            return !0 === options.noempty && (result = result.filter(Boolean)), !0 === options.nodupes && (result = [
                ...new Set(result)
            ]), result;
        }, braces.create = (input, options = {})=>'' === input || input.length < 3 ? [
                input
            ] : !0 !== options.expand ? braces.compile(input, options) : braces.expand(input, options), module.exports = braces;
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/compile.js" (module, __unused_rspack_exports, __webpack_require__) {
        let fill = __webpack_require__("../../node_modules/.pnpm/fill-range@7.1.1/node_modules/fill-range/index.js"), utils = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/utils.js");
        module.exports = (ast, options = {})=>{
            let walk = (node, parent = {})=>{
                let invalidBlock = utils.isInvalidBrace(parent), invalidNode = !0 === node.invalid && !0 === options.escapeInvalid, invalid = !0 === invalidBlock || !0 === invalidNode, prefix = !0 === options.escapeInvalid ? '\\' : '', output = '';
                if (!0 === node.isOpen) return prefix + node.value;
                if (!0 === node.isClose) return console.log('node.isClose', prefix, node.value), prefix + node.value;
                if ('open' === node.type) return invalid ? prefix + node.value : '(';
                if ('close' === node.type) return invalid ? prefix + node.value : ')';
                if ('comma' === node.type) return 'comma' === node.prev.type ? '' : invalid ? node.value : '|';
                if (node.value) return node.value;
                if (node.nodes && node.ranges > 0) {
                    let args = utils.reduce(node.nodes), range = fill(...args, {
                        ...options,
                        wrap: !1,
                        toRegex: !0,
                        strictZeros: !0
                    });
                    if (0 !== range.length) return args.length > 1 && range.length > 1 ? `(${range})` : range;
                }
                if (node.nodes) for (let child of node.nodes)output += walk(child, node);
                return output;
            };
            return walk(ast);
        };
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/constants.js" (module) {
        module.exports = {
            MAX_LENGTH: 10000,
            CHAR_0: '0',
            CHAR_9: '9',
            CHAR_UPPERCASE_A: 'A',
            CHAR_LOWERCASE_A: 'a',
            CHAR_UPPERCASE_Z: 'Z',
            CHAR_LOWERCASE_Z: 'z',
            CHAR_LEFT_PARENTHESES: '(',
            CHAR_RIGHT_PARENTHESES: ')',
            CHAR_ASTERISK: '*',
            CHAR_AMPERSAND: '&',
            CHAR_AT: '@',
            CHAR_BACKSLASH: '\\',
            CHAR_BACKTICK: '`',
            CHAR_CARRIAGE_RETURN: '\r',
            CHAR_CIRCUMFLEX_ACCENT: '^',
            CHAR_COLON: ':',
            CHAR_COMMA: ',',
            CHAR_DOLLAR: '$',
            CHAR_DOT: '.',
            CHAR_DOUBLE_QUOTE: '"',
            CHAR_EQUAL: '=',
            CHAR_EXCLAMATION_MARK: '!',
            CHAR_FORM_FEED: '\f',
            CHAR_FORWARD_SLASH: '/',
            CHAR_HASH: '#',
            CHAR_HYPHEN_MINUS: '-',
            CHAR_LEFT_ANGLE_BRACKET: '<',
            CHAR_LEFT_CURLY_BRACE: '{',
            CHAR_LEFT_SQUARE_BRACKET: '[',
            CHAR_LINE_FEED: '\n',
            CHAR_NO_BREAK_SPACE: '\u00A0',
            CHAR_PERCENT: '%',
            CHAR_PLUS: '+',
            CHAR_QUESTION_MARK: '?',
            CHAR_RIGHT_ANGLE_BRACKET: '>',
            CHAR_RIGHT_CURLY_BRACE: '}',
            CHAR_RIGHT_SQUARE_BRACKET: ']',
            CHAR_SEMICOLON: ';',
            CHAR_SINGLE_QUOTE: '\'',
            CHAR_SPACE: ' ',
            CHAR_TAB: '\t',
            CHAR_UNDERSCORE: '_',
            CHAR_VERTICAL_LINE: '|',
            CHAR_ZERO_WIDTH_NOBREAK_SPACE: '\uFEFF'
        };
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/expand.js" (module, __unused_rspack_exports, __webpack_require__) {
        let fill = __webpack_require__("../../node_modules/.pnpm/fill-range@7.1.1/node_modules/fill-range/index.js"), stringify = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/stringify.js"), utils = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/utils.js"), append = (queue = '', stash = '', enclose = !1)=>{
            let result = [];
            if (queue = [].concat(queue), !(stash = [].concat(stash)).length) return queue;
            if (!queue.length) return enclose ? utils.flatten(stash).map((ele)=>`{${ele}}`) : stash;
            for (let item of queue)if (Array.isArray(item)) for (let value of item)result.push(append(value, stash, enclose));
            else for (let ele of stash)!0 === enclose && 'string' == typeof ele && (ele = `{${ele}}`), result.push(Array.isArray(ele) ? append(item, ele, enclose) : item + ele);
            return utils.flatten(result);
        };
        module.exports = (ast, options = {})=>{
            let rangeLimit = void 0 === options.rangeLimit ? 1000 : options.rangeLimit, walk = (node, parent = {})=>{
                node.queue = [];
                let p = parent, q = parent.queue;
                for(; 'brace' !== p.type && 'root' !== p.type && p.parent;)q = (p = p.parent).queue;
                if (node.invalid || node.dollar) return void q.push(append(q.pop(), stringify(node, options)));
                if ('brace' === node.type && !0 !== node.invalid && 2 === node.nodes.length) return void q.push(append(q.pop(), [
                    '{}'
                ]));
                if (node.nodes && node.ranges > 0) {
                    let args = utils.reduce(node.nodes);
                    if (utils.exceedsLimit(...args, options.step, rangeLimit)) throw RangeError('expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.');
                    let range = fill(...args, options);
                    0 === range.length && (range = stringify(node, options)), q.push(append(q.pop(), range)), node.nodes = [];
                    return;
                }
                let enclose = utils.encloseBrace(node), queue = node.queue, block = node;
                for(; 'brace' !== block.type && 'root' !== block.type && block.parent;)queue = (block = block.parent).queue;
                for(let i = 0; i < node.nodes.length; i++){
                    let child = node.nodes[i];
                    if ('comma' === child.type && 'brace' === node.type) {
                        1 === i && queue.push(''), queue.push('');
                        continue;
                    }
                    if ('close' === child.type) {
                        q.push(append(q.pop(), queue, enclose));
                        continue;
                    }
                    if (child.value && 'open' !== child.type) {
                        queue.push(append(queue.pop(), child.value));
                        continue;
                    }
                    child.nodes && walk(child, node);
                }
                return queue;
            };
            return utils.flatten(walk(ast));
        };
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/parse.js" (module, __unused_rspack_exports, __webpack_require__) {
        let stringify = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/stringify.js"), { MAX_LENGTH, CHAR_BACKSLASH, CHAR_BACKTICK, CHAR_COMMA, CHAR_DOT, CHAR_LEFT_PARENTHESES, CHAR_RIGHT_PARENTHESES, CHAR_LEFT_CURLY_BRACE, CHAR_RIGHT_CURLY_BRACE, CHAR_LEFT_SQUARE_BRACKET, CHAR_RIGHT_SQUARE_BRACKET, CHAR_DOUBLE_QUOTE, CHAR_SINGLE_QUOTE, CHAR_NO_BREAK_SPACE, CHAR_ZERO_WIDTH_NOBREAK_SPACE } = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/constants.js");
        module.exports = (input, options = {})=>{
            let value;
            if ('string' != typeof input) throw TypeError('Expected a string');
            let opts = options || {}, max = 'number' == typeof opts.maxLength ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
            if (input.length > max) throw SyntaxError(`Input length (${input.length}), exceeds max characters (${max})`);
            let ast = {
                type: 'root',
                input,
                nodes: []
            }, stack = [
                ast
            ], block = ast, prev = ast, brackets = 0, length = input.length, index = 0, depth = 0, advance = ()=>input[index++], push = (node)=>{
                if ('text' === node.type && 'dot' === prev.type && (prev.type = 'text'), prev && 'text' === prev.type && 'text' === node.type) {
                    prev.value += node.value;
                    return;
                }
                return block.nodes.push(node), node.parent = block, node.prev = prev, prev = node, node;
            };
            for(push({
                type: 'bos'
            }); index < length;)if (block = stack[stack.length - 1], (value = advance()) !== CHAR_ZERO_WIDTH_NOBREAK_SPACE && value !== CHAR_NO_BREAK_SPACE) {
                if (value === CHAR_BACKSLASH) {
                    push({
                        type: 'text',
                        value: (options.keepEscaping ? value : '') + advance()
                    });
                    continue;
                }
                if (value === CHAR_RIGHT_SQUARE_BRACKET) {
                    push({
                        type: 'text',
                        value: '\\' + value
                    });
                    continue;
                }
                if (value === CHAR_LEFT_SQUARE_BRACKET) {
                    let next;
                    for(brackets++; index < length && (next = advance());){
                        if (value += next, next === CHAR_LEFT_SQUARE_BRACKET) {
                            brackets++;
                            continue;
                        }
                        if (next === CHAR_BACKSLASH) {
                            value += advance();
                            continue;
                        }
                        if (next === CHAR_RIGHT_SQUARE_BRACKET && 0 == --brackets) break;
                    }
                    push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if (value === CHAR_LEFT_PARENTHESES) {
                    block = push({
                        type: 'paren',
                        nodes: []
                    }), stack.push(block), push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if (value === CHAR_RIGHT_PARENTHESES) {
                    if ('paren' !== block.type) {
                        push({
                            type: 'text',
                            value
                        });
                        continue;
                    }
                    block = stack.pop(), push({
                        type: 'text',
                        value
                    }), block = stack[stack.length - 1];
                    continue;
                }
                if (value === CHAR_DOUBLE_QUOTE || value === CHAR_SINGLE_QUOTE || value === CHAR_BACKTICK) {
                    let next, open = value;
                    for(!0 !== options.keepQuotes && (value = ''); index < length && (next = advance());){
                        if (next === CHAR_BACKSLASH) {
                            value += next + advance();
                            continue;
                        }
                        if (next === open) {
                            !0 === options.keepQuotes && (value += next);
                            break;
                        }
                        value += next;
                    }
                    push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if (value === CHAR_LEFT_CURLY_BRACE) {
                    depth++, block = push({
                        type: 'brace',
                        open: !0,
                        close: !1,
                        dollar: prev.value && '$' === prev.value.slice(-1) || !0 === block.dollar,
                        depth,
                        commas: 0,
                        ranges: 0,
                        nodes: []
                    }), stack.push(block), push({
                        type: 'open',
                        value
                    });
                    continue;
                }
                if (value === CHAR_RIGHT_CURLY_BRACE) {
                    if ('brace' !== block.type) {
                        push({
                            type: 'text',
                            value
                        });
                        continue;
                    }
                    (block = stack.pop()).close = !0, push({
                        type: 'close',
                        value
                    }), depth--, block = stack[stack.length - 1];
                    continue;
                }
                if (value === CHAR_COMMA && depth > 0) {
                    if (block.ranges > 0) {
                        block.ranges = 0;
                        let open = block.nodes.shift();
                        block.nodes = [
                            open,
                            {
                                type: 'text',
                                value: stringify(block)
                            }
                        ];
                    }
                    push({
                        type: 'comma',
                        value
                    }), block.commas++;
                    continue;
                }
                if (value === CHAR_DOT && depth > 0 && 0 === block.commas) {
                    let siblings = block.nodes;
                    if (0 === depth || 0 === siblings.length) {
                        push({
                            type: 'text',
                            value
                        });
                        continue;
                    }
                    if ('dot' === prev.type) {
                        if (block.range = [], prev.value += value, prev.type = 'range', 3 !== block.nodes.length && 5 !== block.nodes.length) {
                            block.invalid = !0, block.ranges = 0, prev.type = 'text';
                            continue;
                        }
                        block.ranges++, block.args = [];
                        continue;
                    }
                    if ('range' === prev.type) {
                        siblings.pop();
                        let before = siblings[siblings.length - 1];
                        before.value += prev.value + value, prev = before, block.ranges--;
                        continue;
                    }
                    push({
                        type: 'dot',
                        value
                    });
                    continue;
                }
                push({
                    type: 'text',
                    value
                });
            }
            do if ('root' !== (block = stack.pop()).type) {
                block.nodes.forEach((node)=>{
                    node.nodes || ('open' === node.type && (node.isOpen = !0), 'close' === node.type && (node.isClose = !0), node.nodes || (node.type = 'text'), node.invalid = !0);
                });
                let parent = stack[stack.length - 1], index = parent.nodes.indexOf(block);
                parent.nodes.splice(index, 1, ...block.nodes);
            }
            while (stack.length > 0);
            return push({
                type: 'eos'
            }), ast;
        };
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/stringify.js" (module, __unused_rspack_exports, __webpack_require__) {
        let utils = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/utils.js");
        module.exports = (ast, options = {})=>{
            let stringify = (node, parent = {})=>{
                let invalidBlock = options.escapeInvalid && utils.isInvalidBrace(parent), invalidNode = !0 === node.invalid && !0 === options.escapeInvalid, output = '';
                if (node.value) return (invalidBlock || invalidNode) && utils.isOpenOrClose(node) ? '\\' + node.value : node.value;
                if (node.value) return node.value;
                if (node.nodes) for (let child of node.nodes)output += stringify(child);
                return output;
            };
            return stringify(ast);
        };
    },
    "../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/lib/utils.js" (__unused_rspack_module, exports) {
        exports.isInteger = (num)=>'number' == typeof num ? Number.isInteger(num) : 'string' == typeof num && '' !== num.trim() && Number.isInteger(Number(num)), exports.find = (node, type)=>node.nodes.find((node)=>node.type === type), exports.exceedsLimit = (min, max, step = 1, limit)=>!1 !== limit && !!exports.isInteger(min) && !!exports.isInteger(max) && (Number(max) - Number(min)) / Number(step) >= limit, exports.escapeNode = (block, n = 0, type)=>{
            let node = block.nodes[n];
            node && (type && node.type === type || 'open' === node.type || 'close' === node.type) && !0 !== node.escaped && (node.value = '\\' + node.value, node.escaped = !0);
        }, exports.encloseBrace = (node)=>'brace' === node.type && node.commas >> 0 + node.ranges == 0 && (node.invalid = !0, !0), exports.isInvalidBrace = (block)=>'brace' === block.type && (!0 === block.invalid || !!block.dollar || (block.commas >> 0 + block.ranges == 0 || !0 !== block.open || !0 !== block.close) && (block.invalid = !0, !0)), exports.isOpenOrClose = (node)=>'open' === node.type || 'close' === node.type || !0 === node.open || !0 === node.close, exports.reduce = (nodes)=>nodes.reduce((acc, node)=>('text' === node.type && acc.push(node.value), 'range' === node.type && (node.type = 'text'), acc), []), exports.flatten = (...args)=>{
            let result = [], flat = (arr)=>{
                for(let i = 0; i < arr.length; i++){
                    let ele = arr[i];
                    if (Array.isArray(ele)) {
                        flat(ele);
                        continue;
                    }
                    void 0 !== ele && result.push(ele);
                }
                return result;
            };
            return flat(args), result;
        };
    },
    "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js" (module, exports, __webpack_require__) {
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
        ], exports.log = console.debug || console.log || (()=>{}), module.exports = __webpack_require__("../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js")(exports);
        let { formatters } = module.exports;
        formatters.j = function(v) {
            try {
                return JSON.stringify(v);
            } catch (error) {
                return '[UnexpectedJSONParseError]: ' + error.message;
            }
        };
    },
    "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js" (module, __unused_rspack_exports, __webpack_require__) {
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
            return createDebug.debug = createDebug, createDebug.default = createDebug, createDebug.coerce = coerce, createDebug.disable = disable, createDebug.enable = enable, createDebug.enabled = enabled, createDebug.humanize = __webpack_require__("../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js"), createDebug.destroy = destroy, Object.keys(env).forEach((key)=>{
                createDebug[key] = env[key];
            }), createDebug.names = [], createDebug.skips = [], createDebug.formatters = {}, createDebug.selectColor = selectColor, createDebug.enable(createDebug.load()), createDebug;
        };
    },
    "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        "u" < typeof process || 'renderer' === process.type || !0 === process.browser || process.__nwjs ? module.exports = __webpack_require__("../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/browser.js") : module.exports = __webpack_require__("../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js");
    },
    "../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/node.js" (module, exports, __webpack_require__) {
        let tty = __webpack_require__("tty"), util = __webpack_require__("util");
        exports.init = init, exports.log = log, exports.formatArgs = formatArgs, exports.save = save, exports.load = load, exports.useColors = useColors, exports.destroy = util.deprecate(()=>{}, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.'), exports.colors = [
            6,
            2,
            3,
            4,
            5,
            1
        ];
        try {
            let supportsColor = __webpack_require__("supports-color");
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
        }, {}), module.exports = __webpack_require__("../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/common.js")(exports);
        let { formatters } = module.exports;
        formatters.o = function(v) {
            return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts).split('\n').map((str)=>str.trim()).join(' ');
        }, formatters.O = function(v) {
            return this.inspectOpts.colors = this.useColors, util.inspect(v, this.inspectOpts);
        };
    },
    "../../node_modules/.pnpm/fill-range@7.1.1/node_modules/fill-range/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        let util = __webpack_require__("util"), toRegexRange = __webpack_require__("../../node_modules/.pnpm/to-regex-range@5.0.1/node_modules/to-regex-range/index.js"), isObject = (val)=>null !== val && 'object' == typeof val && !Array.isArray(val), isValidValue = (value)=>'number' == typeof value || 'string' == typeof value && '' !== value, zeros = (input)=>{
            let value = `${input}`, index = -1;
            if ('-' === value[0] && (value = value.slice(1)), '0' === value) return !1;
            for(; '0' === value[++index];);
            return index > 0;
        }, pad = (input, maxLength, toNumber)=>{
            if (maxLength > 0) {
                let dash = '-' === input[0] ? '-' : '';
                dash && (input = input.slice(1)), input = dash + input.padStart(dash ? maxLength - 1 : maxLength, '0');
            }
            return !1 === toNumber ? String(input) : input;
        }, toMaxLen = (input, maxLength)=>{
            let negative = '-' === input[0] ? '-' : '';
            for(negative && (input = input.slice(1), maxLength--); input.length < maxLength;)input = '0' + input;
            return negative ? '-' + input : input;
        }, toRange = (a, b, isNumbers, options)=>{
            if (isNumbers) return toRegexRange(a, b, {
                wrap: !1,
                ...options
            });
            let start = String.fromCharCode(a);
            if (a === b) return start;
            let stop = String.fromCharCode(b);
            return `[${start}-${stop}]`;
        }, toRegex = (start, end, options)=>{
            if (Array.isArray(start)) {
                let wrap = !0 === options.wrap, prefix = options.capture ? '' : '?:';
                return wrap ? `(${prefix}${start.join('|')})` : start.join('|');
            }
            return toRegexRange(start, end, options);
        }, rangeError = (...args)=>RangeError('Invalid range arguments: ' + util.inspect(...args)), invalidRange = (start, end, options)=>{
            if (!0 === options.strictRanges) throw rangeError([
                start,
                end
            ]);
            return [];
        }, fill = (start, end, step, options = {})=>{
            if (null == end && isValidValue(start)) return [
                start
            ];
            if (!isValidValue(start) || !isValidValue(end)) return invalidRange(start, end, options);
            if ('function' == typeof step) return fill(start, end, 1, {
                transform: step
            });
            if (isObject(step)) return fill(start, end, 0, step);
            let opts = {
                ...options
            };
            if (!0 === opts.capture && (opts.wrap = !0), !Number.isInteger(+(step = step || opts.step || 1))) {
                if (null != step && !isObject(step)) {
                    var step1 = step;
                    if (!0 === opts.strictRanges) throw TypeError(`Expected step "${step1}" to be a number`);
                    return [];
                }
                return fill(start, end, 1, step);
            }
            return Number.isInteger(+start) && Number.isInteger(+end) ? ((start, end, step = 1, options = {})=>{
                let a = Number(start), b = Number(end);
                if (!Number.isInteger(a) || !Number.isInteger(b)) {
                    if (!0 === options.strictRanges) throw rangeError([
                        start,
                        end
                    ]);
                    return [];
                }
                0 === a && (a = 0), 0 === b && (b = 0);
                let descending = a > b, startString = String(start), endString = String(end), stepString = String(step);
                step = Math.max(Math.abs(step), 1);
                let padded = zeros(startString) || zeros(endString) || zeros(stepString), maxLen = padded ? Math.max(startString.length, endString.length, stepString.length) : 0, toNumber = !1 === padded && !1 == ('string' == typeof start || 'string' == typeof end || !0 === options.stringify), format = options.transform || ((value)=>!0 === toNumber ? Number(value) : String(value));
                if (options.toRegex && 1 === step) return toRange(toMaxLen(start, maxLen), toMaxLen(end, maxLen), !0, options);
                let parts = {
                    negatives: [],
                    positives: []
                }, push = (num)=>parts[num < 0 ? 'negatives' : 'positives'].push(Math.abs(num)), range = [], index = 0;
                for(; descending ? a >= b : a <= b;)!0 === options.toRegex && step > 1 ? push(a) : range.push(pad(format(a, index), maxLen, toNumber)), a = descending ? a - step : a + step, index++;
                if (!0 === options.toRegex) {
                    let result, prefix, positives, negatives;
                    return step > 1 ? (parts.negatives.sort((a, b)=>a < b ? -1 : +(a > b)), parts.positives.sort((a, b)=>a < b ? -1 : +(a > b)), prefix = options.capture ? '' : '?:', positives = '', negatives = '', (parts.positives.length && (positives = parts.positives.map((v)=>toMaxLen(String(v), maxLen)).join('|')), parts.negatives.length && (negatives = `-(${prefix}${parts.negatives.map((v)=>toMaxLen(String(v), maxLen)).join('|')})`), result = positives && negatives ? `${positives}|${negatives}` : positives || negatives, options.wrap) ? `(${prefix}${result})` : result) : toRegex(range, null, {
                        wrap: !1,
                        ...options
                    });
                }
                return range;
            })(start, end, step, opts) : ((start, end, step = 1, options = {})=>{
                if (!Number.isInteger(+start) && start.length > 1 || !Number.isInteger(+end) && end.length > 1) return invalidRange(start, end, options);
                let format = options.transform || ((val)=>String.fromCharCode(val)), a = `${start}`.charCodeAt(0), b = `${end}`.charCodeAt(0), descending = a > b, min = Math.min(a, b), max = Math.max(a, b);
                if (options.toRegex && 1 === step) return toRange(min, max, !1, options);
                let range = [], index = 0;
                for(; descending ? a >= b : a <= b;)range.push(format(a, index)), a = descending ? a - step : a + step, index++;
                return !0 === options.toRegex ? toRegex(range, null, {
                    wrap: !1,
                    options
                }) : range;
            })(start, end, Math.max(Math.abs(step), 1), opts);
        };
        module.exports = fill;
    },
    "../../node_modules/.pnpm/is-extglob@2.1.1/node_modules/is-extglob/index.js" (module) {
        module.exports = function isExtglob(str) {
            var match;
            if ('string' != typeof str || '' === str) return !1;
            for(; match = /(\\).|([@?!+*]\(.*\))/g.exec(str);){
                if (match[2]) return !0;
                str = str.slice(match.index + match[0].length);
            }
            return !1;
        };
    },
    "../../node_modules/.pnpm/is-glob@4.0.3/node_modules/is-glob/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        var isExtglob = __webpack_require__("../../node_modules/.pnpm/is-extglob@2.1.1/node_modules/is-extglob/index.js"), chars = {
            '{': '}',
            '(': ')',
            '[': ']'
        }, strictCheck = function(str) {
            if ('!' === str[0]) return !0;
            for(var index = 0, pipeIndex = -2, closeSquareIndex = -2, closeCurlyIndex = -2, closeParenIndex = -2, backSlashIndex = -2; index < str.length;){
                if ('*' === str[index] || '?' === str[index + 1] && /[\].+)]/.test(str[index]) || -1 !== closeSquareIndex && '[' === str[index] && ']' !== str[index + 1] && (closeSquareIndex < index && (closeSquareIndex = str.indexOf(']', index)), closeSquareIndex > index) && (-1 === backSlashIndex || backSlashIndex > closeSquareIndex || -1 === (backSlashIndex = str.indexOf('\\', index)) || backSlashIndex > closeSquareIndex) || -1 !== closeCurlyIndex && '{' === str[index] && '}' !== str[index + 1] && (closeCurlyIndex = str.indexOf('}', index)) > index && (-1 === (backSlashIndex = str.indexOf('\\', index)) || backSlashIndex > closeCurlyIndex) || -1 !== closeParenIndex && '(' === str[index] && '?' === str[index + 1] && /[:!=]/.test(str[index + 2]) && ')' !== str[index + 3] && (closeParenIndex = str.indexOf(')', index)) > index && (-1 === (backSlashIndex = str.indexOf('\\', index)) || backSlashIndex > closeParenIndex) || -1 !== pipeIndex && '(' === str[index] && '|' !== str[index + 1] && (pipeIndex < index && (pipeIndex = str.indexOf('|', index)), -1 !== pipeIndex && ')' !== str[pipeIndex + 1] && (closeParenIndex = str.indexOf(')', pipeIndex)) > pipeIndex) && (-1 === (backSlashIndex = str.indexOf('\\', pipeIndex)) || backSlashIndex > closeParenIndex)) return !0;
                if ('\\' === str[index]) {
                    var open = str[index + 1];
                    index += 2;
                    var close = chars[open];
                    if (close) {
                        var n = str.indexOf(close, index);
                        -1 !== n && (index = n + 1);
                    }
                    if ('!' === str[index]) return !0;
                } else index++;
            }
            return !1;
        }, relaxedCheck = function(str) {
            if ('!' === str[0]) return !0;
            for(var index = 0; index < str.length;){
                if (/[*?{}()[\]]/.test(str[index])) return !0;
                if ('\\' === str[index]) {
                    var open = str[index + 1];
                    index += 2;
                    var close = chars[open];
                    if (close) {
                        var n = str.indexOf(close, index);
                        -1 !== n && (index = n + 1);
                    }
                    if ('!' === str[index]) return !0;
                } else index++;
            }
            return !1;
        };
        module.exports = function isGlob(str, options) {
            if ('string' != typeof str || '' === str) return !1;
            if (isExtglob(str)) return !0;
            var check = strictCheck;
            return options && !1 === options.strict && (check = relaxedCheck), check(str);
        };
    },
    "../../node_modules/.pnpm/is-number@7.0.0/node_modules/is-number/index.js" (module) {
        module.exports = function(num) {
            return 'number' == typeof num ? num - num == 0 : 'string' == typeof num && '' !== num.trim() && (Number.isFinite ? Number.isFinite(+num) : isFinite(+num));
        };
    },
    "../../node_modules/.pnpm/micromatch@4.0.8/node_modules/micromatch/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        let util = __webpack_require__("util"), braces = __webpack_require__("../../node_modules/.pnpm/braces@3.0.3/node_modules/braces/index.js"), picomatch = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/index.js"), utils = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js"), isEmptyString = (v)=>'' === v || './' === v, hasBraces = (v)=>{
            let index = v.indexOf('{');
            return index > -1 && v.indexOf('}', index) > -1;
        }, micromatch = (list, patterns, options)=>{
            patterns = [].concat(patterns), list = [].concat(list);
            let omit = new Set(), keep = new Set(), items = new Set(), negatives = 0, onResult = (state)=>{
                items.add(state.output), options && options.onResult && options.onResult(state);
            };
            for(let i = 0; i < patterns.length; i++){
                let isMatch = picomatch(String(patterns[i]), {
                    ...options,
                    onResult
                }, !0), negated = isMatch.state.negated || isMatch.state.negatedExtglob;
                for (let item of (negated && negatives++, list)){
                    let matched = isMatch(item, !0);
                    (negated ? !matched.isMatch : matched.isMatch) && (negated ? omit.add(matched.output) : (omit.delete(matched.output), keep.add(matched.output)));
                }
            }
            let matches = (negatives === patterns.length ? [
                ...items
            ] : [
                ...keep
            ]).filter((item)=>!omit.has(item));
            if (options && 0 === matches.length) {
                if (!0 === options.failglob) throw Error(`No matches found for "${patterns.join(', ')}"`);
                if (!0 === options.nonull || !0 === options.nullglob) return options.unescape ? patterns.map((p)=>p.replace(/\\/g, '')) : patterns;
            }
            return matches;
        };
        micromatch.match = micromatch, micromatch.matcher = (pattern, options)=>picomatch(pattern, options), micromatch.isMatch = (str, patterns, options)=>picomatch(patterns, options)(str), micromatch.any = micromatch.isMatch, micromatch.not = (list, patterns, options = {})=>{
            patterns = [].concat(patterns).map(String);
            let result = new Set(), items = [], matches = new Set(micromatch(list, patterns, {
                ...options,
                onResult: (state)=>{
                    options.onResult && options.onResult(state), items.push(state.output);
                }
            }));
            for (let item of items)matches.has(item) || result.add(item);
            return [
                ...result
            ];
        }, micromatch.contains = (str, pattern, options)=>{
            if ('string' != typeof str) throw TypeError(`Expected a string: "${util.inspect(str)}"`);
            if (Array.isArray(pattern)) return pattern.some((p)=>micromatch.contains(str, p, options));
            if ('string' == typeof pattern) {
                if (isEmptyString(str) || isEmptyString(pattern)) return !1;
                if (str.includes(pattern) || str.startsWith('./') && str.slice(2).includes(pattern)) return !0;
            }
            return micromatch.isMatch(str, pattern, {
                ...options,
                contains: !0
            });
        }, micromatch.matchKeys = (obj, patterns, options)=>{
            if (!utils.isObject(obj)) throw TypeError('Expected the first argument to be an object');
            let keys = micromatch(Object.keys(obj), patterns, options), res = {};
            for (let key of keys)res[key] = obj[key];
            return res;
        }, micromatch.some = (list, patterns, options)=>{
            let items = [].concat(list);
            for (let pattern of [].concat(patterns)){
                let isMatch = picomatch(String(pattern), options);
                if (items.some((item)=>isMatch(item))) return !0;
            }
            return !1;
        }, micromatch.every = (list, patterns, options)=>{
            let items = [].concat(list);
            for (let pattern of [].concat(patterns)){
                let isMatch = picomatch(String(pattern), options);
                if (!items.every((item)=>isMatch(item))) return !1;
            }
            return !0;
        }, micromatch.all = (str, patterns, options)=>{
            if ('string' != typeof str) throw TypeError(`Expected a string: "${util.inspect(str)}"`);
            return [].concat(patterns).every((p)=>picomatch(p, options)(str));
        }, micromatch.capture = (glob, input, options)=>{
            let posix = utils.isWindows(options), match = picomatch.makeRe(String(glob), {
                ...options,
                capture: !0
            }).exec(posix ? utils.toPosixSlashes(input) : input);
            if (match) return match.slice(1).map((v)=>void 0 === v ? '' : v);
        }, micromatch.makeRe = (...args)=>picomatch.makeRe(...args), micromatch.scan = (...args)=>picomatch.scan(...args), micromatch.parse = (patterns, options)=>{
            let res = [];
            for (let pattern of [].concat(patterns || []))for (let str of braces(String(pattern), options))res.push(picomatch.parse(str, options));
            return res;
        }, micromatch.braces = (pattern, options)=>{
            if ('string' != typeof pattern) throw TypeError('Expected a string');
            return options && !0 === options.nobrace || !hasBraces(pattern) ? [
                pattern
            ] : braces(pattern, options);
        }, micromatch.braceExpand = (pattern, options)=>{
            if ('string' != typeof pattern) throw TypeError('Expected a string');
            return micromatch.braces(pattern, {
                ...options,
                expand: !0
            });
        }, micromatch.hasBraces = hasBraces, module.exports = micromatch;
    },
    "../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js" (module) {
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
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        module.exports = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/picomatch.js");
    },
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js" (module, __unused_rspack_exports, __webpack_require__) {
        let path = __webpack_require__("path?aeb1"), WIN_NO_SLASH = "[^\\\\/]", QMARK = '[^/]', END_ANCHOR = "(?:\\/|$)", START_ANCHOR = "(?:^|\\/)", DOTS_SLASH = `\\.{1,2}${END_ANCHOR}`, NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`, NO_DOT_SLASH = `(?!\\.{0,1}${END_ANCHOR})`, NO_DOTS_SLASH = `(?!${DOTS_SLASH})`, STAR = `${QMARK}*?`, POSIX_CHARS = {
            DOT_LITERAL: '\\.',
            PLUS_LITERAL: '\\+',
            QMARK_LITERAL: '\\?',
            SLASH_LITERAL: '\\/',
            ONE_CHAR: '(?=.)',
            QMARK,
            END_ANCHOR,
            DOTS_SLASH,
            NO_DOT: "(?!\\.)",
            NO_DOTS,
            NO_DOT_SLASH,
            NO_DOTS_SLASH,
            QMARK_NO_DOT: "[^.\\/]",
            STAR,
            START_ANCHOR
        }, WINDOWS_CHARS = {
            ...POSIX_CHARS,
            SLASH_LITERAL: "[\\\\/]",
            QMARK: WIN_NO_SLASH,
            STAR: `${WIN_NO_SLASH}*?`,
            DOTS_SLASH: "\\.{1,2}(?:[\\\\/]|$)",
            NO_DOT: "(?!\\.)",
            NO_DOTS: "(?!(?:^|[\\\\/])\\.{1,2}(?:[\\\\/]|$))",
            NO_DOT_SLASH: "(?!\\.{0,1}(?:[\\\\/]|$))",
            NO_DOTS_SLASH: "(?!\\.{1,2}(?:[\\\\/]|$))",
            QMARK_NO_DOT: "[^.\\\\/]",
            START_ANCHOR: "(?:^|[\\\\/])",
            END_ANCHOR: "(?:[\\\\/]|$)"
        };
        module.exports = {
            DEFAULT_MAX_EXTGLOB_RECURSION: 0,
            MAX_LENGTH: 65536,
            POSIX_REGEX_SOURCE: {
                __proto__: null,
                alnum: 'a-zA-Z0-9',
                alpha: 'a-zA-Z',
                ascii: '\\x00-\\x7F',
                blank: ' \\t',
                cntrl: '\\x00-\\x1F\\x7F',
                digit: '0-9',
                graph: '\\x21-\\x7E',
                lower: 'a-z',
                print: '\\x20-\\x7E ',
                punct: '\\-!"#$%&\'()\\*+,./:;<=>?@[\\]^_`{|}~',
                space: ' \\t\\r\\n\\v\\f',
                upper: 'A-Z',
                word: 'A-Za-z0-9_',
                xdigit: 'A-Fa-f0-9'
            },
            REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
            REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
            REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
            REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
            REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
            REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
            REPLACEMENTS: {
                __proto__: null,
                '***': '*',
                '**/**': '**',
                '**/**/**': '**'
            },
            CHAR_0: 48,
            CHAR_9: 57,
            CHAR_UPPERCASE_A: 65,
            CHAR_LOWERCASE_A: 97,
            CHAR_UPPERCASE_Z: 90,
            CHAR_LOWERCASE_Z: 122,
            CHAR_LEFT_PARENTHESES: 40,
            CHAR_RIGHT_PARENTHESES: 41,
            CHAR_ASTERISK: 42,
            CHAR_AMPERSAND: 38,
            CHAR_AT: 64,
            CHAR_BACKWARD_SLASH: 92,
            CHAR_CARRIAGE_RETURN: 13,
            CHAR_CIRCUMFLEX_ACCENT: 94,
            CHAR_COLON: 58,
            CHAR_COMMA: 44,
            CHAR_DOT: 46,
            CHAR_DOUBLE_QUOTE: 34,
            CHAR_EQUAL: 61,
            CHAR_EXCLAMATION_MARK: 33,
            CHAR_FORM_FEED: 12,
            CHAR_FORWARD_SLASH: 47,
            CHAR_GRAVE_ACCENT: 96,
            CHAR_HASH: 35,
            CHAR_HYPHEN_MINUS: 45,
            CHAR_LEFT_ANGLE_BRACKET: 60,
            CHAR_LEFT_CURLY_BRACE: 123,
            CHAR_LEFT_SQUARE_BRACKET: 91,
            CHAR_LINE_FEED: 10,
            CHAR_NO_BREAK_SPACE: 160,
            CHAR_PERCENT: 37,
            CHAR_PLUS: 43,
            CHAR_QUESTION_MARK: 63,
            CHAR_RIGHT_ANGLE_BRACKET: 62,
            CHAR_RIGHT_CURLY_BRACE: 125,
            CHAR_RIGHT_SQUARE_BRACKET: 93,
            CHAR_SEMICOLON: 59,
            CHAR_SINGLE_QUOTE: 39,
            CHAR_SPACE: 32,
            CHAR_TAB: 9,
            CHAR_UNDERSCORE: 95,
            CHAR_VERTICAL_LINE: 124,
            CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
            SEP: path.sep,
            extglobChars: (chars)=>({
                    '!': {
                        type: 'negate',
                        open: '(?:(?!(?:',
                        close: `))${chars.STAR})`
                    },
                    '?': {
                        type: 'qmark',
                        open: '(?:',
                        close: ')?'
                    },
                    '+': {
                        type: 'plus',
                        open: '(?:',
                        close: ')+'
                    },
                    '*': {
                        type: 'star',
                        open: '(?:',
                        close: ')*'
                    },
                    '@': {
                        type: 'at',
                        open: '(?:',
                        close: ')'
                    }
                }),
            globChars: (win32)=>!0 === win32 ? WINDOWS_CHARS : POSIX_CHARS
        };
    },
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/parse.js" (module, __unused_rspack_exports, __webpack_require__) {
        let constants = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js"), utils = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js"), { MAX_LENGTH, POSIX_REGEX_SOURCE, REGEX_NON_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_BACKREF, REPLACEMENTS } = constants, expandRange = (args, options)=>{
            if ('function' == typeof options.expandRange) return options.expandRange(...args, options);
            args.sort();
            let value = `[${args.join('-')}]`;
            try {
                new RegExp(value);
            } catch (ex) {
                return args.map((v)=>utils.escapeRegex(v)).join('..');
            }
            return value;
        }, syntaxError = (type, char)=>`Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`, splitTopLevel = (input)=>{
            let parts = [], bracket = 0, paren = 0, quote = 0, value = '', escaped = !1;
            for (let ch of input){
                if (!0 === escaped) {
                    value += ch, escaped = !1;
                    continue;
                }
                if ('\\' === ch) {
                    value += ch, escaped = !0;
                    continue;
                }
                if ('"' === ch) {
                    quote = +(1 !== quote), value += ch;
                    continue;
                }
                if (0 === quote) {
                    if ('[' === ch) bracket++;
                    else if (']' === ch && bracket > 0) bracket--;
                    else if (0 === bracket) {
                        if ('(' === ch) paren++;
                        else if (')' === ch && paren > 0) paren--;
                        else if ('|' === ch && 0 === paren) {
                            parts.push(value), value = '';
                            continue;
                        }
                    }
                }
                value += ch;
            }
            return parts.push(value), parts;
        }, normalizeSimpleBranch = (branch)=>{
            let value = branch.trim(), changed = !0;
            for(; !0 === changed;)changed = !1, /^@\([^\\()[\]{}|]+\)$/.test(value) && (value = value.slice(2, -1), changed = !0);
            if (((branch)=>{
                let escaped = !1;
                for (let ch of branch){
                    if (!0 === escaped) {
                        escaped = !1;
                        continue;
                    }
                    if ('\\' === ch) {
                        escaped = !0;
                        continue;
                    }
                    if (/[?*+@!()[\]{}]/.test(ch)) return !1;
                }
                return !0;
            })(value)) return value.replace(/\\(.)/g, '$1');
        }, parseRepeatedExtglob = (pattern, requireEnd = !0)=>{
            if ('+' !== pattern[0] && '*' !== pattern[0] || '(' !== pattern[1]) return;
            let bracket = 0, paren = 0, quote = 0, escaped = !1;
            for(let i = 1; i < pattern.length; i++){
                let ch = pattern[i];
                if (!0 === escaped) {
                    escaped = !1;
                    continue;
                }
                if ('\\' === ch) {
                    escaped = !0;
                    continue;
                }
                if ('"' === ch) {
                    quote = +(1 !== quote);
                    continue;
                }
                if (1 !== quote) {
                    if ('[' === ch) {
                        bracket++;
                        continue;
                    }
                    if (']' === ch && bracket > 0) {
                        bracket--;
                        continue;
                    }
                    if (!(bracket > 0)) {
                        if ('(' === ch) {
                            paren++;
                            continue;
                        }
                        if (')' === ch && 0 == --paren) {
                            if (!0 === requireEnd && i !== pattern.length - 1) return;
                            return {
                                type: pattern[0],
                                body: pattern.slice(2, i),
                                end: i
                            };
                        }
                    }
                }
            }
        }, getStarExtglobSequenceOutput = (pattern)=>{
            let index = 0, chars = [];
            for(; index < pattern.length;){
                let match = parseRepeatedExtglob(pattern.slice(index), !1);
                if (!match || '*' !== match.type) return;
                let branches = splitTopLevel(match.body).map((branch)=>branch.trim());
                if (1 !== branches.length) return;
                let branch = normalizeSimpleBranch(branches[0]);
                if (!branch || 1 !== branch.length) return;
                chars.push(branch), index += match.end + 1;
            }
            if (chars.length < 1) return;
            let source = 1 === chars.length ? utils.escapeRegex(chars[0]) : `[${chars.map((ch)=>utils.escapeRegex(ch)).join('')}]`;
            return `${source}*`;
        }, repeatedExtglobRecursion = (pattern)=>{
            let depth = 0, value = pattern.trim(), match = parseRepeatedExtglob(value);
            for(; match;)depth++, match = parseRepeatedExtglob(value = match.body.trim());
            return depth;
        }, parse = (input, options)=>{
            let value;
            if ('string' != typeof input) throw TypeError('Expected a string');
            input = REPLACEMENTS[input] || input;
            let opts = {
                ...options
            }, max = 'number' == typeof opts.maxLength ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH, len = input.length;
            if (len > max) throw SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
            let bos = {
                type: 'bos',
                value: '',
                output: opts.prepend || ''
            }, tokens = [
                bos
            ], capture = opts.capture ? '' : '?:', win32 = utils.isWindows(options), PLATFORM_CHARS = constants.globChars(win32), EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS), { DOT_LITERAL, PLUS_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOT_SLASH, NO_DOTS_SLASH, QMARK, QMARK_NO_DOT, STAR, START_ANCHOR } = PLATFORM_CHARS, globstar = (opts)=>`(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`, nodot = opts.dot ? '' : NO_DOT, qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT, star = !0 === opts.bash ? globstar(opts) : STAR;
            opts.capture && (star = `(${star})`), 'boolean' == typeof opts.noext && (opts.noextglob = opts.noext);
            let state = {
                input,
                index: -1,
                start: 0,
                dot: !0 === opts.dot,
                consumed: '',
                output: '',
                prefix: '',
                backtrack: !1,
                negated: !1,
                brackets: 0,
                braces: 0,
                parens: 0,
                quotes: 0,
                globstar: !1,
                tokens
            };
            len = (input = utils.removePrefix(input, state)).length;
            let extglobs = [], braces = [], stack = [], prev = bos, eos = ()=>state.index === len - 1, peek = state.peek = (n = 1)=>input[state.index + n], advance = state.advance = ()=>input[++state.index] || '', remaining = ()=>input.slice(state.index + 1), consume = (value = '', num = 0)=>{
                state.consumed += value, state.index += num;
            }, append = (token)=>{
                state.output += null != token.output ? token.output : token.value, consume(token.value);
            }, negate = ()=>{
                let count = 1;
                for(; '!' === peek() && ('(' !== peek(2) || '?' === peek(3));)advance(), state.start++, count++;
                return count % 2 != 0 && (state.negated = !0, state.start++, !0);
            }, increment = (type)=>{
                state[type]++, stack.push(type);
            }, decrement = (type)=>{
                state[type]--, stack.pop();
            }, push = (tok)=>{
                if ('globstar' === prev.type) {
                    let isBrace = state.braces > 0 && ('comma' === tok.type || 'brace' === tok.type), isExtglob = !0 === tok.extglob || extglobs.length && ('pipe' === tok.type || 'paren' === tok.type);
                    'slash' === tok.type || 'paren' === tok.type || isBrace || isExtglob || (state.output = state.output.slice(0, -prev.output.length), prev.type = 'star', prev.value = '*', prev.output = star, state.output += prev.output);
                }
                if (extglobs.length && 'paren' !== tok.type && (extglobs[extglobs.length - 1].inner += tok.value), (tok.value || tok.output) && append(tok), prev && 'text' === prev.type && 'text' === tok.type) {
                    prev.value += tok.value, prev.output = (prev.output || '') + tok.value;
                    return;
                }
                tok.prev = prev, tokens.push(tok), prev = tok;
            }, extglobOpen = (type, value)=>{
                let token = {
                    ...EXTGLOB_CHARS[value],
                    conditions: 1,
                    inner: ''
                };
                token.prev = prev, token.parens = state.parens, token.output = state.output, token.startIndex = state.index, token.tokensIndex = tokens.length;
                let output = (opts.capture ? '(' : '') + token.open;
                increment('parens'), push({
                    type,
                    value,
                    output: state.output ? '' : ONE_CHAR
                }), push({
                    type: 'paren',
                    extglob: !0,
                    value: advance(),
                    output
                }), extglobs.push(token);
            }, extglobClose = (token)=>{
                let rest, literal = input.slice(token.startIndex, state.index + 1), analysis = ((body, options)=>{
                    if (!1 === options.maxExtglobRecursion) return {
                        risky: !1
                    };
                    let max = 'number' == typeof options.maxExtglobRecursion ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION, branches = splitTopLevel(body).map((branch)=>branch.trim());
                    if (branches.length > 1 && (branches.some((branch)=>'' === branch) || branches.some((branch)=>/^[*?]+$/.test(branch)) || ((branches)=>{
                        let values = branches.map(normalizeSimpleBranch).filter(Boolean);
                        for(let i = 0; i < values.length; i++)for(let j = i + 1; j < values.length; j++){
                            let a = values[i], b = values[j], char = a[0];
                            if (char && a === char.repeat(a.length) && b === char.repeat(b.length) && (a === b || a.startsWith(b) || b.startsWith(a))) return !0;
                        }
                        return !1;
                    })(branches))) return {
                        risky: !0
                    };
                    for (let branch of branches){
                        let safeOutput = getStarExtglobSequenceOutput(branch);
                        if (safeOutput) return {
                            risky: !0,
                            safeOutput
                        };
                        if (repeatedExtglobRecursion(branch) > max) return {
                            risky: !0
                        };
                    }
                    return {
                        risky: !1
                    };
                })(input.slice(token.startIndex + 2, state.index), opts);
                if (('plus' === token.type || 'star' === token.type) && analysis.risky) {
                    let safeOutput = analysis.safeOutput ? (token.output ? '' : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0, open = tokens[token.tokensIndex];
                    open.type = 'text', open.value = literal, open.output = safeOutput || utils.escapeRegex(literal);
                    for(let i = token.tokensIndex + 1; i < tokens.length; i++)tokens[i].value = '', tokens[i].output = '', delete tokens[i].suffix;
                    state.output = token.output + open.output, state.backtrack = !0, push({
                        type: 'paren',
                        extglob: !0,
                        value,
                        output: ''
                    }), decrement('parens');
                    return;
                }
                let output = token.close + (opts.capture ? ')' : '');
                if ('negate' === token.type) {
                    let extglobStar = star;
                    if (token.inner && token.inner.length > 1 && token.inner.includes('/') && (extglobStar = globstar(opts)), (extglobStar !== star || eos() || /^\)+$/.test(remaining())) && (output = token.close = `)$))${extglobStar}`), token.inner.includes('*') && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
                        let expression = parse(rest, {
                            ...options,
                            fastpaths: !1
                        }).output;
                        output = token.close = `)${expression})${extglobStar})`;
                    }
                    'bos' === token.prev.type && (state.negatedExtglob = !0);
                }
                push({
                    type: 'paren',
                    extglob: !0,
                    value,
                    output
                }), decrement('parens');
            };
            if (!1 !== opts.fastpaths && !/(^[*!]|[/()[\]{}"])/.test(input)) {
                let backslashes = !1, output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index)=>'\\' === first ? (backslashes = !0, m) : '?' === first ? esc ? esc + first + (rest ? QMARK.repeat(rest.length) : '') : 0 === index ? qmarkNoDot + (rest ? QMARK.repeat(rest.length) : '') : QMARK.repeat(chars.length) : '.' === first ? DOT_LITERAL.repeat(chars.length) : '*' === first ? esc ? esc + first + (rest ? star : '') : star : esc ? m : `\\${m}`);
                return (!0 === backslashes && (output = !0 === opts.unescape ? output.replace(/\\/g, '') : output.replace(/\\+/g, (m)=>m.length % 2 == 0 ? '\\\\' : m ? '\\' : '')), output === input && !0 === opts.contains) ? state.output = input : state.output = utils.wrapOutput(output, state, options), state;
            }
            for(; !eos();){
                if ('\u0000' === (value = advance())) continue;
                if ('\\' === value) {
                    let next = peek();
                    if ('/' === next && !0 !== opts.bash || '.' === next || ';' === next) continue;
                    if (!next) {
                        push({
                            type: 'text',
                            value: value += '\\'
                        });
                        continue;
                    }
                    let match = /^\\+/.exec(remaining()), slashes = 0;
                    if (match && match[0].length > 2 && (slashes = match[0].length, state.index += slashes, slashes % 2 != 0 && (value += '\\')), !0 === opts.unescape ? value = advance() : value += advance(), 0 === state.brackets) {
                        push({
                            type: 'text',
                            value
                        });
                        continue;
                    }
                }
                if (state.brackets > 0 && (']' !== value || '[' === prev.value || '[^' === prev.value)) {
                    if (!1 !== opts.posix && ':' === value) {
                        let inner = prev.value.slice(1);
                        if (inner.includes('[') && (prev.posix = !0, inner.includes(':'))) {
                            let idx = prev.value.lastIndexOf('['), pre = prev.value.slice(0, idx), posix = POSIX_REGEX_SOURCE[prev.value.slice(idx + 2)];
                            if (posix) {
                                prev.value = pre + posix, state.backtrack = !0, advance(), bos.output || 1 !== tokens.indexOf(prev) || (bos.output = ONE_CHAR);
                                continue;
                            }
                        }
                    }
                    ('[' === value && ':' !== peek() || '-' === value && ']' === peek()) && (value = `\\${value}`), ']' === value && ('[' === prev.value || '[^' === prev.value) && (value = `\\${value}`), !0 === opts.posix && '!' === value && '[' === prev.value && (value = '^'), prev.value += value, append({
                        value
                    });
                    continue;
                }
                if (1 === state.quotes && '"' !== value) {
                    value = utils.escapeRegex(value), prev.value += value, append({
                        value
                    });
                    continue;
                }
                if ('"' === value) {
                    state.quotes = +(1 !== state.quotes), !0 === opts.keepQuotes && push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if ('(' === value) {
                    increment('parens'), push({
                        type: 'paren',
                        value
                    });
                    continue;
                }
                if (')' === value) {
                    if (0 === state.parens && !0 === opts.strictBrackets) throw SyntaxError(syntaxError('opening', '('));
                    let extglob = extglobs[extglobs.length - 1];
                    if (extglob && state.parens === extglob.parens + 1) {
                        extglobClose(extglobs.pop());
                        continue;
                    }
                    push({
                        type: 'paren',
                        value,
                        output: state.parens ? ')' : '\\)'
                    }), decrement('parens');
                    continue;
                }
                if ('[' === value) {
                    if (!0 !== opts.nobracket && remaining().includes(']')) increment('brackets');
                    else {
                        if (!0 !== opts.nobracket && !0 === opts.strictBrackets) throw SyntaxError(syntaxError('closing', ']'));
                        value = `\\${value}`;
                    }
                    push({
                        type: 'bracket',
                        value
                    });
                    continue;
                }
                if (']' === value) {
                    if (!0 === opts.nobracket || prev && 'bracket' === prev.type && 1 === prev.value.length) {
                        push({
                            type: 'text',
                            value,
                            output: `\\${value}`
                        });
                        continue;
                    }
                    if (0 === state.brackets) {
                        if (!0 === opts.strictBrackets) throw SyntaxError(syntaxError('opening', '['));
                        push({
                            type: 'text',
                            value,
                            output: `\\${value}`
                        });
                        continue;
                    }
                    decrement('brackets');
                    let prevValue = prev.value.slice(1);
                    if (!0 === prev.posix || '^' !== prevValue[0] || prevValue.includes('/') || (value = `/${value}`), prev.value += value, append({
                        value
                    }), !1 === opts.literalBrackets || utils.hasRegexChars(prevValue)) continue;
                    let escaped = utils.escapeRegex(prev.value);
                    if (state.output = state.output.slice(0, -prev.value.length), !0 === opts.literalBrackets) {
                        state.output += escaped, prev.value = escaped;
                        continue;
                    }
                    prev.value = `(${capture}${escaped}|${prev.value})`, state.output += prev.value;
                    continue;
                }
                if ('{' === value && !0 !== opts.nobrace) {
                    increment('braces');
                    let open = {
                        type: 'brace',
                        value,
                        output: '(',
                        outputIndex: state.output.length,
                        tokensIndex: state.tokens.length
                    };
                    braces.push(open), push(open);
                    continue;
                }
                if ('}' === value) {
                    let brace = braces[braces.length - 1];
                    if (!0 === opts.nobrace || !brace) {
                        push({
                            type: 'text',
                            value,
                            output: value
                        });
                        continue;
                    }
                    let output = ')';
                    if (!0 === brace.dots) {
                        let arr = tokens.slice(), range = [];
                        for(let i = arr.length - 1; i >= 0 && (tokens.pop(), 'brace' !== arr[i].type); i--)'dots' !== arr[i].type && range.unshift(arr[i].value);
                        output = expandRange(range, opts), state.backtrack = !0;
                    }
                    if (!0 !== brace.comma && !0 !== brace.dots) {
                        let out = state.output.slice(0, brace.outputIndex), toks = state.tokens.slice(brace.tokensIndex);
                        for (let t of (brace.value = brace.output = '\\{', value = output = '\\}', state.output = out, toks))state.output += t.output || t.value;
                    }
                    push({
                        type: 'brace',
                        value,
                        output
                    }), decrement('braces'), braces.pop();
                    continue;
                }
                if ('|' === value) {
                    extglobs.length > 0 && extglobs[extglobs.length - 1].conditions++, push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if (',' === value) {
                    let output = value, brace = braces[braces.length - 1];
                    brace && 'braces' === stack[stack.length - 1] && (brace.comma = !0, output = '|'), push({
                        type: 'comma',
                        value,
                        output
                    });
                    continue;
                }
                if ('/' === value) {
                    if ('dot' === prev.type && state.index === state.start + 1) {
                        state.start = state.index + 1, state.consumed = '', state.output = '', tokens.pop(), prev = bos;
                        continue;
                    }
                    push({
                        type: 'slash',
                        value,
                        output: SLASH_LITERAL
                    });
                    continue;
                }
                if ('.' === value) {
                    if (state.braces > 0 && 'dot' === prev.type) {
                        '.' === prev.value && (prev.output = DOT_LITERAL);
                        let brace = braces[braces.length - 1];
                        prev.type = 'dots', prev.output += value, prev.value += value, brace.dots = !0;
                        continue;
                    }
                    if (state.braces + state.parens === 0 && 'bos' !== prev.type && 'slash' !== prev.type) {
                        push({
                            type: 'text',
                            value,
                            output: DOT_LITERAL
                        });
                        continue;
                    }
                    push({
                        type: 'dot',
                        value,
                        output: DOT_LITERAL
                    });
                    continue;
                }
                if ('?' === value) {
                    if (!(prev && '(' === prev.value) && !0 !== opts.noextglob && '(' === peek() && '?' !== peek(2)) {
                        extglobOpen('qmark', value);
                        continue;
                    }
                    if (prev && 'paren' === prev.type) {
                        let next = peek(), output = value;
                        if ('<' === next && !utils.supportsLookbehinds()) throw Error('Node.js v10 or higher is required for regex lookbehinds');
                        ('(' !== prev.value || /[!=<:]/.test(next)) && ('<' !== next || /<([!=]|\w+>)/.test(remaining())) || (output = `\\${value}`), push({
                            type: 'text',
                            value,
                            output
                        });
                        continue;
                    }
                    if (!0 !== opts.dot && ('slash' === prev.type || 'bos' === prev.type)) {
                        push({
                            type: 'qmark',
                            value,
                            output: QMARK_NO_DOT
                        });
                        continue;
                    }
                    push({
                        type: 'qmark',
                        value,
                        output: QMARK
                    });
                    continue;
                }
                if ('!' === value) {
                    if (!0 !== opts.noextglob && '(' === peek() && ('?' !== peek(2) || !/[!=<:]/.test(peek(3)))) {
                        extglobOpen('negate', value);
                        continue;
                    }
                    if (!0 !== opts.nonegate && 0 === state.index) {
                        negate();
                        continue;
                    }
                }
                if ('+' === value) {
                    if (!0 !== opts.noextglob && '(' === peek() && '?' !== peek(2)) {
                        extglobOpen('plus', value);
                        continue;
                    }
                    if (prev && '(' === prev.value || !1 === opts.regex) {
                        push({
                            type: 'plus',
                            value,
                            output: PLUS_LITERAL
                        });
                        continue;
                    }
                    if (prev && ('bracket' === prev.type || 'paren' === prev.type || 'brace' === prev.type) || state.parens > 0) {
                        push({
                            type: 'plus',
                            value
                        });
                        continue;
                    }
                    push({
                        type: 'plus',
                        value: PLUS_LITERAL
                    });
                    continue;
                }
                if ('@' === value) {
                    if (!0 !== opts.noextglob && '(' === peek() && '?' !== peek(2)) {
                        push({
                            type: 'at',
                            extglob: !0,
                            value,
                            output: ''
                        });
                        continue;
                    }
                    push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if ('*' !== value) {
                    ('$' === value || '^' === value) && (value = `\\${value}`);
                    let match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
                    match && (value += match[0], state.index += match[0].length), push({
                        type: 'text',
                        value
                    });
                    continue;
                }
                if (prev && ('globstar' === prev.type || !0 === prev.star)) {
                    prev.type = 'star', prev.star = !0, prev.value += value, prev.output = star, state.backtrack = !0, state.globstar = !0, consume(value);
                    continue;
                }
                let rest = remaining();
                if (!0 !== opts.noextglob && /^\([^?]/.test(rest)) {
                    extglobOpen('star', value);
                    continue;
                }
                if ('star' === prev.type) {
                    if (!0 === opts.noglobstar) {
                        consume(value);
                        continue;
                    }
                    let prior = prev.prev, before = prior.prev, isStart = 'slash' === prior.type || 'bos' === prior.type, afterStar = before && ('star' === before.type || 'globstar' === before.type);
                    if (!0 === opts.bash && (!isStart || rest[0] && '/' !== rest[0])) {
                        push({
                            type: 'star',
                            value,
                            output: ''
                        });
                        continue;
                    }
                    let isBrace = state.braces > 0 && ('comma' === prior.type || 'brace' === prior.type), isExtglob = extglobs.length && ('pipe' === prior.type || 'paren' === prior.type);
                    if (!isStart && 'paren' !== prior.type && !isBrace && !isExtglob) {
                        push({
                            type: 'star',
                            value,
                            output: ''
                        });
                        continue;
                    }
                    for(; '/**' === rest.slice(0, 3);){
                        let after = input[state.index + 4];
                        if (after && '/' !== after) break;
                        rest = rest.slice(3), consume('/**', 3);
                    }
                    if ('bos' === prior.type && eos()) {
                        prev.type = 'globstar', prev.value += value, prev.output = globstar(opts), state.output = prev.output, state.globstar = !0, consume(value);
                        continue;
                    }
                    if ('slash' === prior.type && 'bos' !== prior.prev.type && !afterStar && eos()) {
                        state.output = state.output.slice(0, -(prior.output + prev.output).length), prior.output = `(?:${prior.output}`, prev.type = 'globstar', prev.output = globstar(opts) + (opts.strictSlashes ? ')' : '|$)'), prev.value += value, state.globstar = !0, state.output += prior.output + prev.output, consume(value);
                        continue;
                    }
                    if ('slash' === prior.type && 'bos' !== prior.prev.type && '/' === rest[0]) {
                        let end = void 0 !== rest[1] ? '|$' : '';
                        state.output = state.output.slice(0, -(prior.output + prev.output).length), prior.output = `(?:${prior.output}`, prev.type = 'globstar', prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`, prev.value += value, state.output += prior.output + prev.output, state.globstar = !0, consume(value + advance()), push({
                            type: 'slash',
                            value: '/',
                            output: ''
                        });
                        continue;
                    }
                    if ('bos' === prior.type && '/' === rest[0]) {
                        prev.type = 'globstar', prev.value += value, prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`, state.output = prev.output, state.globstar = !0, consume(value + advance()), push({
                            type: 'slash',
                            value: '/',
                            output: ''
                        });
                        continue;
                    }
                    state.output = state.output.slice(0, -prev.output.length), prev.type = 'globstar', prev.output = globstar(opts), prev.value += value, state.output += prev.output, state.globstar = !0, consume(value);
                    continue;
                }
                let token = {
                    type: 'star',
                    value,
                    output: star
                };
                if (!0 === opts.bash) {
                    token.output = '.*?', ('bos' === prev.type || 'slash' === prev.type) && (token.output = nodot + token.output), push(token);
                    continue;
                }
                if (prev && ('bracket' === prev.type || 'paren' === prev.type) && !0 === opts.regex) {
                    token.output = value, push(token);
                    continue;
                }
                (state.index === state.start || 'slash' === prev.type || 'dot' === prev.type) && ('dot' === prev.type ? (state.output += NO_DOT_SLASH, prev.output += NO_DOT_SLASH) : !0 === opts.dot ? (state.output += NO_DOTS_SLASH, prev.output += NO_DOTS_SLASH) : (state.output += nodot, prev.output += nodot), '*' !== peek() && (state.output += ONE_CHAR, prev.output += ONE_CHAR)), push(token);
            }
            for(; state.brackets > 0;){
                if (!0 === opts.strictBrackets) throw SyntaxError(syntaxError('closing', ']'));
                state.output = utils.escapeLast(state.output, '['), decrement('brackets');
            }
            for(; state.parens > 0;){
                if (!0 === opts.strictBrackets) throw SyntaxError(syntaxError('closing', ')'));
                state.output = utils.escapeLast(state.output, '('), decrement('parens');
            }
            for(; state.braces > 0;){
                if (!0 === opts.strictBrackets) throw SyntaxError(syntaxError('closing', '}'));
                state.output = utils.escapeLast(state.output, '{'), decrement('braces');
            }
            if (!0 !== opts.strictSlashes && ('star' === prev.type || 'bracket' === prev.type) && push({
                type: 'maybe_slash',
                value: '',
                output: `${SLASH_LITERAL}?`
            }), !0 === state.backtrack) for (let token of (state.output = '', state.tokens))state.output += null != token.output ? token.output : token.value, token.suffix && (state.output += token.suffix);
            return state;
        };
        parse.fastpaths = (input, options)=>{
            let opts = {
                ...options
            }, max = 'number' == typeof opts.maxLength ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH, len = input.length;
            if (len > max) throw SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
            input = REPLACEMENTS[input] || input;
            let win32 = utils.isWindows(options), { DOT_LITERAL, SLASH_LITERAL, ONE_CHAR, DOTS_SLASH, NO_DOT, NO_DOTS, NO_DOTS_SLASH, STAR, START_ANCHOR } = constants.globChars(win32), nodot = opts.dot ? NO_DOTS : NO_DOT, slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT, capture = opts.capture ? '' : '?:', star = !0 === opts.bash ? '.*?' : STAR;
            opts.capture && (star = `(${star})`);
            let globstar = (opts)=>!0 === opts.noglobstar ? star : `(${capture}(?:(?!${START_ANCHOR}${opts.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`, create = (str)=>{
                switch(str){
                    case '*':
                        return `${nodot}${ONE_CHAR}${star}`;
                    case '.*':
                        return `${DOT_LITERAL}${ONE_CHAR}${star}`;
                    case '*.*':
                        return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
                    case '*/*':
                        return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
                    case '**':
                        return nodot + globstar(opts);
                    case '**/*':
                        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
                    case '**/*.*':
                        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
                    case '**/.*':
                        return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
                    default:
                        {
                            let match = /^(.*?)\.(\w+)$/.exec(str);
                            if (!match) return;
                            let source = create(match[1]);
                            if (!source) return;
                            return source + DOT_LITERAL + match[2];
                        }
                }
            }, source = create(utils.removePrefix(input, {
                negated: !1,
                prefix: ''
            }));
            return source && !0 !== opts.strictSlashes && (source += `${SLASH_LITERAL}?`), source;
        }, module.exports = parse;
    },
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/picomatch.js" (module, __unused_rspack_exports, __webpack_require__) {
        let path = __webpack_require__("path?aeb1"), scan = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/scan.js"), parse = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/parse.js"), utils = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js"), constants = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js"), picomatch = (glob, options, returnState = !1)=>{
            if (Array.isArray(glob)) {
                let fns = glob.map((input)=>picomatch(input, options, returnState));
                return (str)=>{
                    for (let isMatch of fns){
                        let state = isMatch(str);
                        if (state) return state;
                    }
                    return !1;
                };
            }
            let isState = glob && 'object' == typeof glob && !Array.isArray(glob) && glob.tokens && glob.input;
            if ('' === glob || 'string' != typeof glob && !isState) throw TypeError('Expected pattern to be a non-empty string');
            let opts = options || {}, posix = utils.isWindows(options), regex = isState ? picomatch.compileRe(glob, options) : picomatch.makeRe(glob, options, !1, !0), state = regex.state;
            delete regex.state;
            let isIgnored = ()=>!1;
            if (opts.ignore) {
                let ignoreOpts = {
                    ...options,
                    ignore: null,
                    onMatch: null,
                    onResult: null
                };
                isIgnored = picomatch(opts.ignore, ignoreOpts, returnState);
            }
            let matcher = (input, returnObject = !1)=>{
                let { isMatch, match, output } = picomatch.test(input, regex, options, {
                    glob,
                    posix
                }), result = {
                    glob,
                    state,
                    regex,
                    posix,
                    input,
                    output,
                    match,
                    isMatch
                };
                return ('function' == typeof opts.onResult && opts.onResult(result), !1 === isMatch) ? (result.isMatch = !1, !!returnObject && result) : isIgnored(input) ? ('function' == typeof opts.onIgnore && opts.onIgnore(result), result.isMatch = !1, !!returnObject && result) : ('function' == typeof opts.onMatch && opts.onMatch(result), !returnObject || result);
            };
            return returnState && (matcher.state = state), matcher;
        };
        picomatch.test = (input, regex, options, { glob, posix } = {})=>{
            if ('string' != typeof input) throw TypeError('Expected input to be a string');
            if ('' === input) return {
                isMatch: !1,
                output: ''
            };
            let opts = options || {}, format = opts.format || (posix ? utils.toPosixSlashes : null), match = input === glob, output = match && format ? format(input) : input;
            return !1 === match && (match = (output = format ? format(input) : input) === glob), (!1 === match || !0 === opts.capture) && (match = !0 === opts.matchBase || !0 === opts.basename ? picomatch.matchBase(input, regex, options, posix) : regex.exec(output)), {
                isMatch: !!match,
                match,
                output
            };
        }, picomatch.matchBase = (input, glob, options, posix = utils.isWindows(options))=>(glob instanceof RegExp ? glob : picomatch.makeRe(glob, options)).test(path.basename(input)), picomatch.isMatch = (str, patterns, options)=>picomatch(patterns, options)(str), picomatch.parse = (pattern, options)=>Array.isArray(pattern) ? pattern.map((p)=>picomatch.parse(p, options)) : parse(pattern, {
                ...options,
                fastpaths: !1
            }), picomatch.scan = (input, options)=>scan(input, options), picomatch.compileRe = (state, options, returnOutput = !1, returnState = !1)=>{
            if (!0 === returnOutput) return state.output;
            let opts = options || {}, prepend = opts.contains ? '' : '^', append = opts.contains ? '' : '$', source = `${prepend}(?:${state.output})${append}`;
            state && !0 === state.negated && (source = `^(?!${source}).*$`);
            let regex = picomatch.toRegex(source, options);
            return !0 === returnState && (regex.state = state), regex;
        }, picomatch.makeRe = (input, options = {}, returnOutput = !1, returnState = !1)=>{
            if (!input || 'string' != typeof input) throw TypeError('Expected a non-empty string');
            let parsed = {
                negated: !1,
                fastpaths: !0
            };
            return !1 !== options.fastpaths && ('.' === input[0] || '*' === input[0]) && (parsed.output = parse.fastpaths(input, options)), parsed.output || (parsed = parse(input, options)), picomatch.compileRe(parsed, options, returnOutput, returnState);
        }, picomatch.toRegex = (source, options)=>{
            try {
                let opts = options || {};
                return new RegExp(source, opts.flags || (opts.nocase ? 'i' : ''));
            } catch (err) {
                if (options && !0 === options.debug) throw err;
                return /$^/;
            }
        }, picomatch.constants = constants, module.exports = picomatch;
    },
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/scan.js" (module, __unused_rspack_exports, __webpack_require__) {
        let utils = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js"), { CHAR_ASTERISK, CHAR_AT, CHAR_BACKWARD_SLASH, CHAR_COMMA, CHAR_DOT, CHAR_EXCLAMATION_MARK, CHAR_FORWARD_SLASH, CHAR_LEFT_CURLY_BRACE, CHAR_LEFT_PARENTHESES, CHAR_LEFT_SQUARE_BRACKET, CHAR_PLUS, CHAR_QUESTION_MARK, CHAR_RIGHT_CURLY_BRACE, CHAR_RIGHT_PARENTHESES, CHAR_RIGHT_SQUARE_BRACKET } = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js"), isPathSeparator = (code)=>code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH, depth = (token)=>{
            !0 !== token.isPrefix && (token.depth = token.isGlobstar ? 1 / 0 : 1);
        };
        module.exports = (input, options)=>{
            let prev, code, opts = options || {}, length = input.length - 1, scanToEnd = !0 === opts.parts || !0 === opts.scanToEnd, slashes = [], tokens = [], parts = [], str = input, index = -1, start = 0, lastIndex = 0, isBrace = !1, isBracket = !1, isGlob = !1, isExtglob = !1, isGlobstar = !1, braceEscaped = !1, backslashes = !1, negated = !1, negatedExtglob = !1, finished = !1, braces = 0, token = {
                value: '',
                depth: 0,
                isGlob: !1
            }, eos = ()=>index >= length, peek = ()=>str.charCodeAt(index + 1), advance = ()=>(prev = code, str.charCodeAt(++index));
            for(; index < length;){
                let next;
                if ((code = advance()) === CHAR_BACKWARD_SLASH) {
                    backslashes = token.backslashes = !0, (code = advance()) === CHAR_LEFT_CURLY_BRACE && (braceEscaped = !0);
                    continue;
                }
                if (!0 === braceEscaped || code === CHAR_LEFT_CURLY_BRACE) {
                    for(braces++; !0 !== eos() && (code = advance());){
                        if (code === CHAR_BACKWARD_SLASH) {
                            backslashes = token.backslashes = !0, advance();
                            continue;
                        }
                        if (code === CHAR_LEFT_CURLY_BRACE) {
                            braces++;
                            continue;
                        }
                        if (!0 !== braceEscaped && code === CHAR_DOT && (code = advance()) === CHAR_DOT || !0 !== braceEscaped && code === CHAR_COMMA) {
                            if (isBrace = token.isBrace = !0, isGlob = token.isGlob = !0, finished = !0, !0 === scanToEnd) continue;
                            break;
                        }
                        if (code === CHAR_RIGHT_CURLY_BRACE && 0 == --braces) {
                            braceEscaped = !1, isBrace = token.isBrace = !0, finished = !0;
                            break;
                        }
                    }
                    if (!0 === scanToEnd) continue;
                    break;
                }
                if (code === CHAR_FORWARD_SLASH) {
                    if (slashes.push(index), tokens.push(token), token = {
                        value: '',
                        depth: 0,
                        isGlob: !1
                    }, !0 === finished) continue;
                    if (prev === CHAR_DOT && index === start + 1) {
                        start += 2;
                        continue;
                    }
                    lastIndex = index + 1;
                    continue;
                }
                if (!0 !== opts.noext && !0 == (code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK) && peek() === CHAR_LEFT_PARENTHESES) {
                    if (isGlob = token.isGlob = !0, isExtglob = token.isExtglob = !0, finished = !0, code === CHAR_EXCLAMATION_MARK && index === start && (negatedExtglob = !0), !0 === scanToEnd) {
                        for(; !0 !== eos() && (code = advance());){
                            if (code === CHAR_BACKWARD_SLASH) {
                                backslashes = token.backslashes = !0, code = advance();
                                continue;
                            }
                            if (code === CHAR_RIGHT_PARENTHESES) {
                                isGlob = token.isGlob = !0, finished = !0;
                                break;
                            }
                        }
                        continue;
                    }
                    break;
                }
                if (code === CHAR_ASTERISK) {
                    if (prev === CHAR_ASTERISK && (isGlobstar = token.isGlobstar = !0), isGlob = token.isGlob = !0, finished = !0, !0 === scanToEnd) continue;
                    break;
                }
                if (code === CHAR_QUESTION_MARK) {
                    if (isGlob = token.isGlob = !0, finished = !0, !0 === scanToEnd) continue;
                    break;
                }
                if (code === CHAR_LEFT_SQUARE_BRACKET) {
                    for(; !0 !== eos() && (next = advance());){
                        if (next === CHAR_BACKWARD_SLASH) {
                            backslashes = token.backslashes = !0, advance();
                            continue;
                        }
                        if (next === CHAR_RIGHT_SQUARE_BRACKET) {
                            isBracket = token.isBracket = !0, isGlob = token.isGlob = !0, finished = !0;
                            break;
                        }
                    }
                    if (!0 === scanToEnd) continue;
                    break;
                }
                if (!0 !== opts.nonegate && code === CHAR_EXCLAMATION_MARK && index === start) {
                    negated = token.negated = !0, start++;
                    continue;
                }
                if (!0 !== opts.noparen && code === CHAR_LEFT_PARENTHESES) {
                    if (isGlob = token.isGlob = !0, !0 === scanToEnd) {
                        for(; !0 !== eos() && (code = advance());){
                            if (code === CHAR_LEFT_PARENTHESES) {
                                backslashes = token.backslashes = !0, code = advance();
                                continue;
                            }
                            if (code === CHAR_RIGHT_PARENTHESES) {
                                finished = !0;
                                break;
                            }
                        }
                        continue;
                    }
                    break;
                }
                if (!0 === isGlob) {
                    if (finished = !0, !0 === scanToEnd) continue;
                    break;
                }
            }
            !0 === opts.noext && (isExtglob = !1, isGlob = !1);
            let base = str, prefix = '', glob = '';
            start > 0 && (prefix = str.slice(0, start), str = str.slice(start), lastIndex -= start), base && !0 === isGlob && lastIndex > 0 ? (base = str.slice(0, lastIndex), glob = str.slice(lastIndex)) : !0 === isGlob ? (base = '', glob = str) : base = str, base && '' !== base && '/' !== base && base !== str && isPathSeparator(base.charCodeAt(base.length - 1)) && (base = base.slice(0, -1)), !0 === opts.unescape && (glob && (glob = utils.removeBackslashes(glob)), base && !0 === backslashes && (base = utils.removeBackslashes(base)));
            let state = {
                prefix,
                input,
                start,
                base,
                glob,
                isBrace,
                isBracket,
                isGlob,
                isExtglob,
                isGlobstar,
                negated,
                negatedExtglob
            };
            if (!0 === opts.tokens && (state.maxDepth = 0, isPathSeparator(code) || tokens.push(token), state.tokens = tokens), !0 === opts.parts || !0 === opts.tokens) {
                let prevIndex;
                for(let idx = 0; idx < slashes.length; idx++){
                    let n = prevIndex ? prevIndex + 1 : start, i = slashes[idx], value = input.slice(n, i);
                    opts.tokens && (0 === idx && 0 !== start ? (tokens[idx].isPrefix = !0, tokens[idx].value = prefix) : tokens[idx].value = value, depth(tokens[idx]), state.maxDepth += tokens[idx].depth), (0 !== idx || '' !== value) && parts.push(value), prevIndex = i;
                }
                if (prevIndex && prevIndex + 1 < input.length) {
                    let value = input.slice(prevIndex + 1);
                    parts.push(value), opts.tokens && (tokens[tokens.length - 1].value = value, depth(tokens[tokens.length - 1]), state.maxDepth += tokens[tokens.length - 1].depth);
                }
                state.slashes = slashes, state.parts = parts;
            }
            return state;
        };
    },
    "../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/utils.js" (__unused_rspack_module, exports, __webpack_require__) {
        let path = __webpack_require__("path?aeb1"), win32 = 'win32' === process.platform, { REGEX_BACKSLASH, REGEX_REMOVE_BACKSLASH, REGEX_SPECIAL_CHARS, REGEX_SPECIAL_CHARS_GLOBAL } = __webpack_require__("../../node_modules/.pnpm/picomatch@2.3.2/node_modules/picomatch/lib/constants.js");
        exports.isObject = (val)=>null !== val && 'object' == typeof val && !Array.isArray(val), exports.hasRegexChars = (str)=>REGEX_SPECIAL_CHARS.test(str), exports.isRegexChar = (str)=>1 === str.length && exports.hasRegexChars(str), exports.escapeRegex = (str)=>str.replace(REGEX_SPECIAL_CHARS_GLOBAL, '\\$1'), exports.toPosixSlashes = (str)=>str.replace(REGEX_BACKSLASH, '/'), exports.removeBackslashes = (str)=>str.replace(REGEX_REMOVE_BACKSLASH, (match)=>'\\' === match ? '' : match), exports.supportsLookbehinds = ()=>{
            let segs = process.version.slice(1).split('.').map(Number);
            return 3 === segs.length && !!(segs[0] >= 9) || 8 === segs[0] && !!(segs[1] >= 10);
        }, exports.isWindows = (options)=>options && 'boolean' == typeof options.windows ? options.windows : !0 === win32 || '\\' === path.sep, exports.escapeLast = (input, char, lastIdx)=>{
            let idx = input.lastIndexOf(char, lastIdx);
            return -1 === idx ? input : '\\' === input[idx - 1] ? exports.escapeLast(input, char, idx - 1) : `${input.slice(0, idx)}\\${input.slice(idx)}`;
        }, exports.removePrefix = (input, state = {})=>{
            let output = input;
            return output.startsWith('./') && (output = output.slice(2), state.prefix = './'), output;
        }, exports.wrapOutput = (input, state = {}, options = {})=>{
            let prepend = options.contains ? '' : '^', append = options.contains ? '' : '$', output = `${prepend}(?:${input})${append}`;
            return !0 === state.negated && (output = `(?:^(?!${output}).*$)`), output;
        };
    },
    "../../node_modules/.pnpm/to-regex-range@5.0.1/node_modules/to-regex-range/index.js" (module, __unused_rspack_exports, __webpack_require__) {
        let isNumber = __webpack_require__("../../node_modules/.pnpm/is-number@7.0.0/node_modules/is-number/index.js"), toRegexRange = (min, max, options)=>{
            if (!1 === isNumber(min)) throw TypeError('toRegexRange: expected the first argument to be a number');
            if (void 0 === max || min === max) return String(min);
            if (!1 === isNumber(max)) throw TypeError('toRegexRange: expected the second argument to be a number.');
            let opts = {
                relaxZeros: !0,
                ...options
            };
            'boolean' == typeof opts.strictZeros && (opts.relaxZeros = !1 === opts.strictZeros);
            let cacheKey = min + ':' + max + '=' + String(opts.relaxZeros) + String(opts.shorthand) + String(opts.capture) + String(opts.wrap);
            if (toRegexRange.cache.hasOwnProperty(cacheKey)) return toRegexRange.cache[cacheKey].result;
            let a = Math.min(min, max), b = Math.max(min, max);
            if (1 === Math.abs(a - b)) {
                let result = min + '|' + max;
                return opts.capture ? `(${result})` : !1 === opts.wrap ? result : `(?:${result})`;
            }
            let isPadded = hasPadding(min) || hasPadding(max), state = {
                min,
                max,
                a,
                b
            }, positives = [], negatives = [];
            return isPadded && (state.isPadded = isPadded, state.maxLen = String(state.max).length), a < 0 && (negatives = splitToPatterns(b < 0 ? Math.abs(b) : 1, Math.abs(a), state, opts), a = state.a = 0), b >= 0 && (positives = splitToPatterns(a, b, state, opts)), state.negatives = negatives, state.positives = positives, state.result = collatePatterns(negatives, positives, opts), !0 === opts.capture ? state.result = `(${state.result})` : !1 !== opts.wrap && positives.length + negatives.length > 1 && (state.result = `(?:${state.result})`), toRegexRange.cache[cacheKey] = state, state.result;
        };
        function collatePatterns(neg, pos, options) {
            let onlyNegative = filterPatterns(neg, pos, '-', !1, options) || [], onlyPositive = filterPatterns(pos, neg, '', !1, options) || [], intersected = filterPatterns(neg, pos, '-?', !0, options) || [];
            return onlyNegative.concat(intersected).concat(onlyPositive).join('|');
        }
        function splitToRanges(min, max) {
            let nines = 1, zeros = 1, stop = countNines(min, 1), stops = new Set([
                max
            ]);
            for(; min <= stop && stop <= max;)stops.add(stop), nines += 1, stop = countNines(min, nines);
            for(stop = countZeros(max + 1, zeros) - 1; min < stop && stop <= max;)stops.add(stop), zeros += 1, stop = countZeros(max + 1, zeros) - 1;
            return (stops = [
                ...stops
            ]).sort(compare), stops;
        }
        function rangeToPattern(start, stop, options) {
            if (start === stop) return {
                pattern: start,
                count: [],
                digits: 0
            };
            let zipped = zip(start, stop), digits = zipped.length, pattern = '', count = 0;
            for(let i = 0; i < digits; i++){
                let [startDigit, stopDigit] = zipped[i];
                startDigit === stopDigit ? pattern += startDigit : '0' !== startDigit || '9' !== stopDigit ? pattern += toCharacterClass(startDigit, stopDigit, options) : count++;
            }
            return count && (pattern += !0 === options.shorthand ? '\\d' : '[0-9]'), {
                pattern,
                count: [
                    count
                ],
                digits
            };
        }
        function splitToPatterns(min, max, tok, options) {
            let prev, ranges = splitToRanges(min, max), tokens = [], start = min;
            for(let i = 0; i < ranges.length; i++){
                let max = ranges[i], obj = rangeToPattern(String(start), String(max), options), zeros = '';
                if (!tok.isPadded && prev && prev.pattern === obj.pattern) {
                    prev.count.length > 1 && prev.count.pop(), prev.count.push(obj.count[0]), prev.string = prev.pattern + toQuantifier(prev.count), start = max + 1;
                    continue;
                }
                tok.isPadded && (zeros = padZeros(max, tok, options)), obj.string = zeros + obj.pattern + toQuantifier(obj.count), tokens.push(obj), start = max + 1, prev = obj;
            }
            return tokens;
        }
        function filterPatterns(arr, comparison, prefix, intersection, options) {
            let result = [];
            for (let ele of arr){
                let { string } = ele;
                intersection || contains(comparison, 'string', string) || result.push(prefix + string), intersection && contains(comparison, 'string', string) && result.push(prefix + string);
            }
            return result;
        }
        function zip(a, b) {
            let arr = [];
            for(let i = 0; i < a.length; i++)arr.push([
                a[i],
                b[i]
            ]);
            return arr;
        }
        function compare(a, b) {
            return a > b ? 1 : b > a ? -1 : 0;
        }
        function contains(arr, key, val) {
            return arr.some((ele)=>ele[key] === val);
        }
        function countNines(min, len) {
            return Number(String(min).slice(0, -len) + '9'.repeat(len));
        }
        function countZeros(integer, zeros) {
            return integer - integer % Math.pow(10, zeros);
        }
        function toQuantifier(digits) {
            let [start = 0, stop = ''] = digits;
            return stop || start > 1 ? `{${start + (stop ? ',' + stop : '')}}` : '';
        }
        function toCharacterClass(a, b, options) {
            return `[${a}${b - a == 1 ? '' : '-'}${b}]`;
        }
        function hasPadding(str) {
            return /^-?(0+)\d/.test(str);
        }
        function padZeros(value, tok, options) {
            if (!tok.isPadded) return value;
            let diff = Math.abs(tok.maxLen - String(value).length), relax = !1 !== options.relaxZeros;
            switch(diff){
                case 0:
                    return '';
                case 1:
                    return relax ? '0?' : '0';
                case 2:
                    return relax ? '0{0,2}' : '00';
                default:
                    return relax ? `0{0,${diff}}` : `0{${diff}}`;
            }
        }
        toRegexRange.cache = {}, toRegexRange.clearCache = ()=>toRegexRange.cache = {}, module.exports = toRegexRange;
    }
});
let upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i, defaultAgents = {
    http: new node_http.Agent({
        keepAlive: !0,
        maxSockets: 256,
        maxFreeSockets: 64
    }),
    https: new node_https.Agent({
        keepAlive: !0,
        maxSockets: 256,
        maxFreeSockets: 64
    })
}, isSSL = /^https|wss/, HTTP2_HEADER_BLACKLIST = [
    ":method",
    ":path",
    ":scheme",
    ":authority"
];
function setupOutgoing(outgoing, options, req, forward) {
    for (let e of (outgoing.port = options[forward || "target"].port || (isSSL.test(options[forward || "target"].protocol ?? "http") ? 443 : 80), [
        "host",
        "hostname",
        "socketPath",
        "pfx",
        "key",
        "passphrase",
        "cert",
        "ca",
        "ciphers",
        "secureProtocol"
    ])){
        let value = options[forward || "target"][e];
        void 0 !== value && (outgoing[e] = value);
    }
    if (void 0 === outgoing.host && "string" == typeof outgoing.hostname) {
        let bracketedHost = outgoing.hostname.includes(":") && !outgoing.hostname.startsWith("[") ? `[${outgoing.hostname}]` : outgoing.hostname;
        outgoing.host = outgoing.port ? `${bracketedHost}:${outgoing.port}` : bracketedHost;
    }
    if (outgoing.method = options.method || req.method, outgoing.headers = {
        ...req.headers
    }, req.headers?.[":authority"] && (outgoing.headers.host = req.headers[":authority"]), options.headers) for (let key of Object.keys(options.headers))outgoing.headers[key] = options.headers[key];
    if (req.httpVersionMajor > 1) for (let header of HTTP2_HEADER_BLACKLIST)delete outgoing.headers[header];
    if (options.auth && (outgoing.auth = options.auth), options.ca && (outgoing.ca = options.ca), isSSL.test(options[forward || "target"].protocol ?? "http") && (outgoing.rejectUnauthorized = void 0 === options.secure || options.secure), void 0 !== options.agent) outgoing.agent = options.agent || !1;
    else if (req.httpVersionMajor > 1 || upgradeHeader.test(req.headers.connection || "")) outgoing.agent = !1;
    else {
        let targetProto = options[forward || "target"].protocol ?? "http";
        outgoing.agent = isSSL.test(targetProto) ? defaultAgents.https : defaultAgents.http;
    }
    outgoing.localAddress = options.localAddress, !outgoing.agent && (outgoing.headers = outgoing.headers || {}, "string" == typeof outgoing.headers.connection && upgradeHeader.test(outgoing.headers.connection) || (outgoing.headers.connection = "close"));
    let target = options[forward || "target"], targetPath = target && !1 !== options.prependPath && target.pathname || "", targetSearch = target instanceof URL && !1 !== options.prependPath && target.search || "", reqUrl = req.url || "", qIdx = reqUrl.indexOf("?"), reqPath = -1 === qIdx ? reqUrl : reqUrl.slice(0, qIdx), reqSearch = -1 === qIdx ? "" : reqUrl.slice(qIdx), normalizedPath = reqPath ? "/" === reqPath[0] ? reqPath : "/" + reqPath : "/", outgoingPath = options.toProxy ? "/" + reqUrl : normalizedPath + reqSearch, fullPath = joinURL(targetPath, outgoingPath = options.ignorePath ? "" : outgoingPath);
    return targetSearch && (fullPath = fullPath.includes("?") ? fullPath.replace("?", targetSearch + "&") : fullPath + targetSearch), outgoing.path = fullPath, options.changeOrigin && (outgoing.headers.host = requiresPort(outgoing.port, options[forward || "target"].protocol) && !hasPort(outgoing.host) ? outgoing.host + ":" + outgoing.port : outgoing.host ?? void 0), outgoing;
}
function joinURL(base, path) {
    if (!base || "/" === base) return path || "/";
    if (!path || "/" === path) return base || "/";
    let baseHasTrailing = "/" === base[base.length - 1], pathHasLeading = "/" === path[0];
    return baseHasTrailing && pathHasLeading ? base + path.slice(1) : baseHasTrailing || pathHasLeading ? base + path : base + "/" + path;
}
function setupSocket(socket) {
    return socket.setTimeout(0), socket.setNoDelay(!0), socket.setKeepAlive(!0, 0), socket;
}
function getPort(req) {
    let hostHeader = req.headers[":authority"] || req.headers.host, res = hostHeader ? hostHeader.match(/:(\d+)/) : "";
    return res ? res[1] : hasEncryptedConnection(req) ? "443" : "80";
}
function hasEncryptedConnection(req) {
    let socket = req.socket;
    return !!socket && "encrypted" in socket && socket.encrypted;
}
function rewriteCookieProperty(header, config, property) {
    return Array.isArray(header) ? header.map(function(headerElement) {
        return rewriteCookieProperty(headerElement, config, property);
    }) : header.replace(RegExp(String.raw`(;\s*` + property + "=)([^;]+)", "i"), function(match, prefix, previousValue) {
        let newValue;
        if (previousValue in config) newValue = config[previousValue];
        else {
            if (!("*" in config)) return match;
            newValue = config["*"];
        }
        return newValue ? prefix + newValue : "";
    });
}
function hasPort(host) {
    return !!host && !!~host.indexOf(":");
}
function requiresPort(_port, _protocol) {
    let protocol = _protocol?.split(":")[0], port = +_port;
    if (!port) return !1;
    switch(protocol){
        case "http":
        case "ws":
            return 80 !== port;
        case "https":
        case "wss":
            return 443 !== port;
        case "ftp":
            return 21 !== port;
        case "gopher":
            return 70 !== port;
        case "file":
            return !1;
    }
    return 0 !== port;
}
let redirectRegex = /^201|30([12378])$/, webOutgoingMiddleware = [
    (req, res, proxyRes)=>{
        ("1.0" === req.httpVersion || req.httpVersionMajor >= 2 || 204 === proxyRes.statusCode || 304 === proxyRes.statusCode) && delete proxyRes.headers["transfer-encoding"];
    },
    (req, res, proxyRes)=>{
        "1.0" === req.httpVersion ? proxyRes.headers.connection = req.headers.connection || "close" : req.httpVersionMajor < 2 && !proxyRes.headers.connection ? proxyRes.headers.connection = req.headers.connection || "keep-alive" : req.httpVersionMajor >= 2 && delete proxyRes.headers.connection;
    },
    (req, res, proxyRes, options)=>{
        if ((options.hostRewrite || options.autoRewrite || options.protocolRewrite) && proxyRes.headers.location && redirectRegex.test(String(proxyRes.statusCode))) {
            let target = _toURL(options.target), u = new URL(proxyRes.headers.location, target);
            target.host === u.host && (options.hostRewrite ? u.host = options.hostRewrite : options.autoRewrite && (req.headers[":authority"] ? u.host = req.headers[":authority"] : req.headers.host && (u.host = req.headers.host)), options.protocolRewrite && (u.protocol = options.protocolRewrite), proxyRes.headers.location = u.toString());
        }
    },
    (req, res, proxyRes, options)=>{
        let rawHeaderKeyMap, rewriteCookieDomainConfig = "string" == typeof options.cookieDomainRewrite ? {
            "*": options.cookieDomainRewrite
        } : options.cookieDomainRewrite, rewriteCookiePathConfig = "string" == typeof options.cookiePathRewrite ? {
            "*": options.cookiePathRewrite
        } : options.cookiePathRewrite, preserveHeaderKeyCase = options.preserveHeaderKeyCase;
        if (preserveHeaderKeyCase && void 0 !== proxyRes.rawHeaders) {
            rawHeaderKeyMap = {};
            for(let i = 0; i < proxyRes.rawHeaders.length; i += 2){
                let key = proxyRes.rawHeaders[i];
                rawHeaderKeyMap[key.toLowerCase()] = key;
            }
        }
        for (let key1 of Object.keys(proxyRes.headers)){
            let header1 = proxyRes.headers[key1];
            preserveHeaderKeyCase && rawHeaderKeyMap && (key1 = rawHeaderKeyMap[key1] || key1);
            var key = key1, header = header1;
            if (void 0 !== header && String(key).trim()) {
                rewriteCookieDomainConfig && "set-cookie" === key.toLowerCase() && (header = rewriteCookieProperty(header, rewriteCookieDomainConfig, "domain")), rewriteCookiePathConfig && "set-cookie" === key.toLowerCase() && (header = rewriteCookieProperty(header, rewriteCookiePathConfig, "path"));
                try {
                    res.setHeader(String(key).trim(), header);
                } catch  {}
            }
        }
    },
    (req, res, proxyRes)=>{
        res.statusCode = proxyRes.statusCode, proxyRes.statusMessage && req.httpVersionMajor < 2 && (res.statusMessage = proxyRes.statusMessage);
    }
];
function _toURL(target) {
    if (target instanceof URL) return target;
    if ("string" == typeof target) return new URL(target);
    let protocol = target.protocol || "http:", host = target.host || target.hostname || "localhost", port = target.port;
    return new URL(`${protocol}//${host}${port ? ":" + port : ""}`);
}
let redirectStatuses = new Set([
    301,
    302,
    303,
    307,
    308
]), webIncomingMiddleware = [
    (req)=>{
        "DELETE" !== req.method && "OPTIONS" !== req.method || req.headers["content-length"] || (req.headers["content-length"] = "0", delete req.headers["transfer-encoding"]);
    },
    (req, res, options)=>{
        options.timeout && req.socket.setTimeout(options.timeout, ()=>{
            req.socket.destroy();
        });
    },
    (req, res, options)=>{
        if (!options.xfwd) return;
        let encrypted = req.isSpdy || hasEncryptedConnection(req), values = {
            for: req.connection.remoteAddress || req.socket.remoteAddress,
            port: getPort(req),
            proto: encrypted ? "https" : "http"
        };
        for (let header of [
            "for",
            "port",
            "proto"
        ]){
            let key = "x-forwarded-" + header;
            req.headers[key] || void 0 === values[header] || (req.headers[key] = values[header]);
        }
        req.headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers[":authority"] || req.headers.host || "";
    },
    (req, res, options, server, head, callback)=>{
        let bodyBuffer;
        server.emit("start", req, res, options.target || options.forward);
        let maxRedirects = "number" == typeof options.followRedirects ? options.followRedirects : 5 * !!options.followRedirects;
        if (options.forward) {
            let forwardReq = (isSSL.test(options.forward.protocol || "http") ? node_https : node_http).request(setupOutgoing(options.ssl || {}, options, req, "forward")), forwardError = createErrorHandler(forwardReq, options.forward);
            if (req.on("error", forwardError), forwardReq.on("error", forwardError), (options.buffer || req).pipe(forwardReq), !options.target) return void res.end();
        }
        let proxyReq = (isSSL.test(options.target.protocol || "http") ? node_https : node_http).request(setupOutgoing(options.ssl || {}, options, req));
        proxyReq.on("socket", (_socket)=>{
            server && !proxyReq.getHeader("expect") && server.emit("proxyReq", proxyReq, req, res, options);
        }), options.proxyTimeout && proxyReq.setTimeout(options.proxyTimeout, function() {
            proxyReq.destroy();
        }), res.on("close", function() {
            res.writableFinished || proxyReq.destroy();
        });
        let proxyError = createErrorHandler(proxyReq, options.target);
        function createErrorHandler(proxyReq, url) {
            return function proxyError(err) {
                if (!req.socket?.writable && "ECONNRESET" === err.code) return server.emit("econnreset", err, req, res, url), proxyReq.destroy();
                callback ? callback(err, req, res, url) : server.emit("error", err, req, res, url);
            };
        }
        if (req.on("error", proxyError), proxyReq.on("error", proxyError), maxRedirects > 0) {
            let chunks = [], source = options.buffer || req;
            source.on("data", (chunk)=>{
                chunks.push("string" == typeof chunk ? Buffer.from(chunk) : chunk), proxyReq.write(chunk);
            }), source.on("end", ()=>{
                bodyBuffer = Buffer.concat(chunks), proxyReq.end();
            }), source.on("error", (err)=>{
                proxyReq.destroy(err);
            });
        } else proxyReq.on("socket", (socket)=>{
            socket.pending ? socket.on("connect", ()=>(options.buffer || req).pipe(proxyReq)) : (options.buffer || req).pipe(proxyReq);
        });
        function handleResponse(proxyRes, redirectCount, currentUrl) {
            let statusCode = proxyRes.statusCode;
            if (maxRedirects > 0 && redirectStatuses.has(statusCode) && redirectCount < maxRedirects && proxyRes.headers.location) {
                proxyRes.resume();
                let location = new URL(proxyRes.headers.location, currentUrl), preserveMethod = 307 === statusCode || 308 === statusCode, redirectMethod = preserveMethod && req.method || "GET", isHTTPS = isSSL.test(location.protocol), agent = isHTTPS ? node_https : node_http, redirectHeaders = {
                    ...req.headers
                };
                options.headers && Object.assign(redirectHeaders, options.headers), redirectHeaders.host = location.host, location.host !== currentUrl.host && (delete redirectHeaders.authorization, delete redirectHeaders.cookie), preserveMethod || (delete redirectHeaders["content-length"], delete redirectHeaders["content-type"], delete redirectHeaders["transfer-encoding"]);
                let redirectOpts = {
                    hostname: location.hostname,
                    port: location.port || (isHTTPS ? 443 : 80),
                    path: location.pathname + location.search,
                    method: redirectMethod,
                    headers: redirectHeaders,
                    agent: options.agent || !1
                };
                isHTTPS && (redirectOpts.rejectUnauthorized = void 0 === options.secure || options.secure);
                let redirectReq = agent.request(redirectOpts);
                server && !redirectReq.getHeader("expect") && server.emit("proxyReq", redirectReq, req, res, options), options.proxyTimeout && redirectReq.setTimeout(options.proxyTimeout, ()=>{
                    redirectReq.destroy();
                });
                let redirectError = createErrorHandler(redirectReq, location);
                redirectReq.on("error", redirectError), redirectReq.on("response", (nextRes)=>{
                    handleResponse(nextRes, redirectCount + 1, location);
                }), preserveMethod && bodyBuffer && bodyBuffer.length > 0 ? redirectReq.end(bodyBuffer) : redirectReq.end();
                return;
            }
            if (server && server.emit("proxyRes", proxyRes, req, res), !res.headersSent && !options.selfHandleResponse) {
                for (let pass of webOutgoingMiddleware)if (pass(req, res, proxyRes, options)) break;
            }
            res.finished ? server && server.emit("end", req, res, proxyRes) : (res.on("close", function() {
                proxyRes.destroy();
            }), proxyRes.on("close", function() {
                proxyRes.complete || res.destroyed || res.destroy();
            }), proxyRes.on("error", function(err) {
                res.destroyed || res.destroy(err), server.listenerCount("error") > 0 && server.emit("error", err, req, res, currentUrl);
            }), proxyRes.on("end", function() {
                server && server.emit("end", req, res, proxyRes);
            }), options.selfHandleResponse || proxyRes.pipe(res));
        }
        proxyReq.on("response", function(proxyRes) {
            handleResponse(proxyRes, 0, options.target);
        });
    }
], websocketIncomingMiddleware = [
    (req, socket)=>{
        if ("GET" !== req.method || !req.headers.upgrade || "websocket" !== req.headers.upgrade.toLowerCase()) return socket.destroy(), !0;
    },
    (req, socket, options)=>{
        if (!options.xfwd) return;
        let values = {
            for: req.connection.remoteAddress || req.socket.remoteAddress,
            port: getPort(req),
            proto: hasEncryptedConnection(req) ? "wss" : "ws"
        };
        for (let header of [
            "for",
            "port",
            "proto"
        ]){
            let key = "x-forwarded-" + header;
            req.headers[key] || void 0 === values[header] || (req.headers[key] = values[header]);
        }
    },
    (req, socket, options, server, head, callback)=>{
        let createHttpHeader = function(line, headers) {
            return Object.keys(headers).reduce(function(head, key) {
                let value = headers[key];
                if (!Array.isArray(value)) return head.push(key + ": " + value), head;
                for (let element of value)head.push(key + ": " + element);
                return head;
            }, [
                line
            ]).join("\r\n") + "\r\n\r\n";
        };
        setupSocket(socket), head && head.length > 0 && socket.unshift(head), socket.on("error", onSocketError);
        let proxyReq = (isSSL.test(options.target.protocol || "http") ? node_https : node_http).request(setupOutgoing(options.ssl || {}, options, req));
        function onSocketError(err) {
            callback ? callback(err, req, socket) : server.emit("error", err, req, socket), proxyReq.destroy();
        }
        function onOutgoingError(err) {
            callback ? callback(err, req, socket) : server.emit("error", err, req, socket), socket.end();
        }
        server && server.emit("proxyReqWs", proxyReq, req, socket, options, head), proxyReq.on("error", onOutgoingError), proxyReq.on("response", function(res) {
            res.upgrade || (!socket.destroyed && socket.writable ? (socket.write(createHttpHeader("HTTP/" + res.httpVersion + " " + res.statusCode + " " + res.statusMessage, res.headers)), res.on("error", onOutgoingError), res.pipe(socket)) : res.resume());
        }), proxyReq.on("upgrade", function(proxyRes, proxySocket, proxyHead) {
            proxySocket.on("error", onOutgoingError), proxySocket.on("end", function() {
                server.emit("close", proxyRes, proxySocket, proxyHead);
            }), socket.removeListener("error", onSocketError), socket.on("error", function() {
                proxySocket.end();
            }), setupSocket(proxySocket), proxyHead && proxyHead.length > 0 && proxySocket.unshift(proxyHead), socket.write(createHttpHeader("HTTP/1.1 101 Switching Protocols", proxyRes.headers)), proxySocket.pipe(socket).pipe(proxySocket), server.emit("open", proxySocket), server.emit("proxySocket", proxySocket);
        }), proxyReq.end();
    }
];
var ERRORS, errors_ERRORS, ProxyServer = class extends EventEmitter {
    _server;
    _webPasses = [
        ...webIncomingMiddleware
    ];
    _wsPasses = [
        ...websocketIncomingMiddleware
    ];
    options;
    web;
    ws;
    constructor(options = {}){
        super(), this.options = options || {}, this.options.prependPath = !1 !== options.prependPath, this.web = _createProxyFn("web", this), this.ws = _createProxyFn("ws", this);
    }
    listen(port, hostname, listeningListener) {
        let closure = (req, res)=>this.web(req, res);
        if (this.options.http2) {
            if (!this.options.ssl) throw Error("HTTP/2 requires ssl option");
            this._server = node_http2.createSecureServer({
                ...this.options.ssl,
                allowHTTP1: !0
            }, closure);
        } else this.options.ssl ? this._server = node_https.createServer(this.options.ssl, closure) : this._server = node_http.createServer(closure);
        return this.options.ws && this._server.on("upgrade", (req, socket, head)=>{
            this.ws(req, socket, this.options, head).catch(()=>{});
        }), this._server.listen(port, hostname, listeningListener), this;
    }
    close(callback) {
        this._server && this._server.close((...args)=>{
            this._server = void 0, callback && Reflect.apply(callback, void 0, args);
        });
    }
    before(type, passName, pass) {
        if ("ws" !== type && "web" !== type) throw Error("type must be `web` or `ws`");
        let passes = this._getPasses(type), i = !1;
        for (let [idx, v] of passes.entries())v.name === passName && (i = idx);
        if (!1 === i) throw Error("No such pass");
        passes.splice(i, 0, pass);
    }
    after(type, passName, pass) {
        if ("ws" !== type && "web" !== type) throw Error("type must be `web` or `ws`");
        let passes = this._getPasses(type), i = !1;
        for (let [idx, v] of passes.entries())v.name === passName && (i = idx);
        if (!1 === i) throw Error("No such pass");
        passes.splice(i++, 0, pass);
    }
    _getPasses(type) {
        return "ws" === type ? this._wsPasses : this._webPasses;
    }
};
function createProxyServer(options = {}) {
    return new ProxyServer(options);
}
function _createProxyFn(type, server) {
    return function(req, res, opts, head) {
        let _resolve, _reject, requestOptions = {
            ...opts,
            ...server.options
        };
        for (let key of [
            "target",
            "forward"
        ])"string" == typeof requestOptions[key] && (requestOptions[key] = new URL(requestOptions[key]));
        if (!requestOptions.target && !requestOptions.forward) return this.emit("error", Error("Must provide a proper URL as target")), Promise.resolve();
        let callbackPromise = new Promise((resolve, reject)=>{
            _resolve = resolve, _reject = reject;
        });
        for (let pass of (res.on("close", ()=>{
            _resolve();
        }), res.on("error", (error)=>{
            _reject(error);
        }), server._getPasses(type))){
            let stop;
            try {
                stop = pass(req, res, requestOptions, server, head, (error, _req, _res, url)=>{
                    server.listenerCount("error") > 0 ? (server.emit("error", error, req, res, url), _resolve()) : _reject(error);
                });
            } catch (error) {
                server.listenerCount("error") > 0 ? (server.emit("error", error, req, res, requestOptions.target || requestOptions.forward), _resolve()) : _reject(error);
                break;
            }
            if (stop) {
                _resolve();
                break;
            }
        }
        return callbackPromise;
    };
}
function verifyConfig(options) {
    if (!options.target && !options.router) throw Error(errors_ERRORS.ERR_CONFIG_FACTORY_TARGET_MISSING);
}
(ERRORS = errors_ERRORS || (errors_ERRORS = {})).ERR_CONFIG_FACTORY_TARGET_MISSING = "[HPM] Missing \"target\" option. Example: {target: \"http://www.example.org\"}", ERRORS.ERR_CONTEXT_MATCHER_GENERIC = "[HPM] Invalid pathFilter. Expecting something like: \"/api\" or [\"/api\", \"/ajax\"]", ERRORS.ERR_CONTEXT_MATCHER_INVALID_ARRAY = "[HPM] Invalid pathFilter. Plain paths (e.g. \"/api\") can not be mixed with globs (e.g. \"/api/**\"). Expecting something like: [\"/api\", \"/ajax\"] or [\"/api/**\", \"!**.html\"].", ERRORS.ERR_PATH_REWRITER_CONFIG = "[HPM] Invalid pathRewrite config. Expecting object with pathRewrite config or a rewrite function";
let Debug = __webpack_require__("../../node_modules/.pnpm/debug@4.4.3/node_modules/debug/src/index.js")('http-proxy-middleware'), debug = Debug.extend('debug-proxy-errors-plugin'), debugProxyErrorsPlugin = (proxyServer, options)=>{
    proxyServer.on('error', (error, req, res, target)=>{
        debug(`httpxy error event: \n%O`, error);
    }), proxyServer.on('proxyReq', (proxyReq, req, socket)=>{
        socket.on('error', (error)=>{
            debug('Socket error in proxyReq event: \n%O', error);
        });
    }), proxyServer.on('proxyRes', (proxyRes, req, res)=>{
        res.on('close', ()=>{
            res.writableEnded || (debug('Destroying proxyRes in proxyRes close event'), proxyRes.destroy());
        });
    }), proxyServer.on('proxyReqWs', (proxyReq, req, socket)=>{
        socket.on('error', (error)=>{
            debug('Socket error in proxyReqWs event: \n%O', error);
        });
    }), proxyServer.on('open', (proxySocket)=>{
        proxySocket.on('error', (error)=>{
            debug('Socket error in open event: \n%O', error);
        });
    }), proxyServer.on('close', (req, socket, head)=>{
        socket.on('error', (error)=>{
            debug('Socket error in close event: \n%O', error);
        });
    }), proxyServer.on('econnreset', (error, req, res, target)=>{
        debug(`httpxy econnreset event: \n%O`, error);
    });
};
function getStatusCode(errorCode) {
    let statusCode;
    if (/HPE_INVALID/.test(errorCode)) statusCode = 502;
    else switch(errorCode){
        case 'ECONNRESET':
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
        case 'ETIMEDOUT':
            statusCode = 504;
            break;
        default:
            statusCode = 500;
    }
    return statusCode;
}
function sanitize(input) {
    return input?.replace(/[<>]/g, (i)=>encodeURIComponent(i)) ?? '';
}
function isResponseLike(obj) {
    return obj && 'function' == typeof obj.writeHead;
}
function isSocketLike(obj) {
    return obj && 'function' == typeof obj.write && !('writeHead' in obj);
}
let errorResponsePlugin = (proxyServer, options)=>{
    proxyServer.on('error', (err, req, res, target)=>{
        if (!req || !res) throw err;
        if (isResponseLike(res)) {
            if (!res.headersSent) {
                let statusCode = getStatusCode(err.code);
                res.writeHead(statusCode);
            }
            let host = req.headers && req.headers.host;
            res.end(`Error occurred while trying to proxy: ${sanitize(host)}${sanitize(req.url)}`);
        } else isSocketLike(res) && res.destroy();
    });
}, noopLogger = {
    info: ()=>{},
    warn: ()=>{},
    error: ()=>{}
};
function createUrl({ protocol, host, port, path }) {
    let ipv6Host = host?.includes(':') ? `[${host}]` : host, url = new external_url_URL(`${protocol || 'undefined:'}//${ipv6Host || '[::]'}`);
    return port && (url.port = port), path && (url.pathname = path), url;
}
function logger_plugin_getPort(sockets) {
    return Object.keys(sockets || {})?.[0]?.split(':')[1];
}
let loggerPlugin = (proxyServer, options)=>{
    let logger = options.logger || noopLogger;
    proxyServer.on('error', (err, req, res, target)=>{
        let hostname = req?.headers?.host, requestHref = `${hostname}${req?.url}`, targetHref = `${target?.href}`;
        logger.error('[HPM] Error occurred while proxying request %s to %s [%s] (%s)', requestHref, targetHref, err.code || err, 'https://nodejs.org/api/errors.html#errors_common_system_errors');
    }), proxyServer.on('proxyRes', (proxyRes, req, res)=>{
        let target, originalUrl = req.originalUrl ?? `${req.baseUrl || ''}${req.url}`;
        try {
            let port = logger_plugin_getPort(proxyRes.req?.agent?.sockets), { protocol, host, path } = proxyRes.req;
            target = createUrl({
                protocol,
                host,
                port,
                path
            });
        } catch (err) {
            console.error('[HPM] Unexpected error while creating target URL', err), (target = new external_node_url_URL(options.target)).pathname = proxyRes.req.path;
        }
        let targetUrl = target.toString(), exchange = `[HPM] ${req.method} ${originalUrl} -> ${targetUrl} [${proxyRes.statusCode}]`;
        logger.info(exchange);
    }), proxyServer.on('open', (socket)=>{
        logger.info('[HPM] Client connected: %o', socket.address());
    }), proxyServer.on('close', (req, proxySocket, proxyHead)=>{
        logger.info('[HPM] Client disconnected: %o', proxySocket.address());
    });
};
function function_getFunctionName(fn) {
    return fn.name || '[anonymous Function]';
}
let proxy_events_debug = Debug.extend('proxy-events-plugin'), proxyEventsPlugin = (proxyServer, options)=>{
    let eventName;
    if (options.on) {
        for(eventName in options.on)if (Object.prototype.hasOwnProperty.call(options.on, eventName)) {
            let handler = options.on[eventName];
            if (!handler) continue;
            proxy_events_debug(`register event handler: "${eventName}" -> "${function_getFunctionName(handler)}"`), proxyServer.on(eventName, handler);
        }
    }
};
function getPlugins(options) {
    let maybeErrorResponsePlugin = options.on?.error ? [] : [
        errorResponsePlugin
    ];
    return [
        ...options.ejectPlugins ? [] : [
            debugProxyErrorsPlugin,
            proxyEventsPlugin,
            loggerPlugin,
            ...maybeErrorResponsePlugin
        ],
        ...options.plugins ?? []
    ];
}
let is_glob = __webpack_require__("../../node_modules/.pnpm/is-glob@4.0.3/node_modules/is-glob/index.js"), micromatch = __webpack_require__("../../node_modules/.pnpm/micromatch@4.0.8/node_modules/micromatch/index.js");
function matchPathFilter(pathFilter = '/', uri, req) {
    if (isStringPath(pathFilter)) return matchSingleStringPath(pathFilter, uri);
    if (isGlobPath(pathFilter)) return matchSingleGlobPath(pathFilter, uri);
    if (Array.isArray(pathFilter)) {
        if (pathFilter.every(isStringPath)) return matchMultiPath(pathFilter, uri);
        if (pathFilter.every(isGlobPath)) return matchMultiGlobPath(pathFilter, uri);
        throw Error(errors_ERRORS.ERR_CONTEXT_MATCHER_INVALID_ARRAY);
    }
    if ('function' == typeof pathFilter) return !!pathFilter(getUrlPathName(uri), req);
    throw Error(errors_ERRORS.ERR_CONTEXT_MATCHER_GENERIC);
}
function matchSingleStringPath(pathFilter, uri) {
    let pathname = getUrlPathName(uri);
    return pathname?.indexOf(pathFilter) === 0;
}
function matchSingleGlobPath(pattern, uri) {
    let matches = micromatch([
        getUrlPathName(uri)
    ], pattern);
    return matches && matches.length > 0;
}
function matchMultiGlobPath(patternList, uri) {
    return matchSingleGlobPath(patternList, uri);
}
function matchMultiPath(pathFilterList, uri) {
    let isMultiPath = !1;
    for (let context of pathFilterList)if (matchSingleStringPath(context, uri)) {
        isMultiPath = !0;
        break;
    }
    return isMultiPath;
}
function getUrlPathName(uri) {
    return uri && new URL(uri, 'http://0.0.0.0').pathname;
}
function isStringPath(pathFilter) {
    return 'string' == typeof pathFilter && !is_glob(pathFilter);
}
function isGlobPath(pathFilter) {
    return is_glob(pathFilter);
}
function isPlainObject(value) {
    if ('object' != typeof value || null === value) return !1;
    let prototype = Object.getPrototypeOf(value);
    return (null === prototype || prototype === Object.prototype || null === Object.getPrototypeOf(prototype)) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}
let path_rewriter_debug = Debug.extend('path-rewriter');
function createPathRewriter(rewriteConfig) {
    let rulesCache;
    if (isValidRewriteConfig(rewriteConfig)) if ('function' == typeof rewriteConfig) return rewriteConfig;
    else return rulesCache = parsePathRewriteRules(rewriteConfig), rewritePath;
    function rewritePath(path) {
        let result = path;
        for (let rule of rulesCache)if (rule.regex.test(path)) {
            path_rewriter_debug('rewriting path from "%s" to "%s"', path, result = result.replace(rule.regex, rule.value));
            break;
        }
        return result;
    }
}
function isValidRewriteConfig(rewriteConfig) {
    if ('function' == typeof rewriteConfig) return !0;
    if (isPlainObject(rewriteConfig)) return 0 !== Object.keys(rewriteConfig).length;
    if (null == rewriteConfig) return !1;
    throw Error(errors_ERRORS.ERR_PATH_REWRITER_CONFIG);
}
function parsePathRewriteRules(rewriteConfig) {
    let rules = [];
    if (isPlainObject(rewriteConfig)) for (let [key, value] of Object.entries(rewriteConfig))rules.push({
        regex: new RegExp(key),
        value: value
    }), path_rewriter_debug('rewrite rule created: "%s" ~> "%s"', key, value);
    return rules;
}
let router_debug = Debug.extend('router');
async function getTarget(req, res, config) {
    let newTarget, router = config.router;
    return isPlainObject(router) ? newTarget = getTargetFromProxyTable(req, router) : 'function' == typeof router && (newTarget = await router(req, res, config)), newTarget;
}
function getTargetFromProxyTable(req, table) {
    let result, host = req.headers.host ?? '', path = req.url ?? '';
    for (let [key, value] of Object.entries(table))if (containsPath(key)) {
        if (isHostAndPathKey(key)) {
            let [keyHost, keyPath] = splitHostAndPathKey(key);
            if (host === keyHost && path.startsWith(keyPath)) {
                router_debug('match: "%s" -> "%s"', key, result = value);
                break;
            }
        } else if (path.startsWith(key)) {
            router_debug('match: "%s" -> "%s"', key, result = value);
            break;
        }
    } else if (key === host) {
        router_debug('match: "%s" -> "%s"', host, result = value);
        break;
    }
    return result;
}
function containsPath(v) {
    return v.indexOf('/') > -1;
}
function isHostAndPathKey(v) {
    return containsPath(v) && !v.startsWith('/');
}
function splitHostAndPathKey(v) {
    let firstSlash = v.indexOf('/');
    return [
        v.slice(0, firstSlash),
        v.slice(firstSlash)
    ];
}
let ipv6_debug = Debug.extend('ipv6');
function normalizeIPv6LiteralTargets(options) {
    options.target = normalizeIPv6ProxyTarget(options.target, 'target'), options.forward = normalizeIPv6ProxyTarget(options.forward, 'forward');
}
function normalizeIPv6ProxyTarget(target, optionName) {
    let targetUrl = toTargetUrl(target);
    if (targetUrl && isBracketedIPv6Hostname(targetUrl.hostname)) {
        let normalizedHostname = normalizeIPv6DestinationHostname(stripBrackets(targetUrl.hostname));
        return ipv6_debug('normalized IPv6 "%s" %s', optionName, target), {
            hostname: normalizedHostname,
            auth: targetUrl.username || targetUrl.password ? `${targetUrl.username}:${targetUrl.password}` : void 0,
            pathname: targetUrl.pathname,
            port: targetUrl.port,
            protocol: targetUrl.protocol,
            search: targetUrl.search
        };
    }
    return target;
}
function toTargetUrl(target) {
    return 'string' == typeof target ? new URL(target) : target instanceof URL ? target : void 0;
}
function isBracketedIPv6Hostname(hostname) {
    return hostname.startsWith('[') && hostname.endsWith(']');
}
function stripBrackets(hostname) {
    return hostname.replace(/^\[|\]$/g, '');
}
function normalizeIPv6DestinationHostname(hostname) {
    return '::' === hostname ? (ipv6_debug('normalizing hostname unspecified IPv6 address (::) to loopback (::1)'), '::1') : hostname;
}
class HttpProxyMiddleware {
    wsInternalSubscribedServers = new WeakSet();
    activeServers = new Set();
    proxyOptions;
    proxy;
    pathRewriter;
    logger;
    constructor(options){
        verifyConfig(options), this.proxyOptions = options, this.logger = options.logger || noopLogger, Debug("create proxy server"), this.proxy = createProxyServer({}), this.registerPlugins(this.proxy, this.proxyOptions), this.pathRewriter = createPathRewriter(this.proxyOptions.pathRewrite), this.middleware.upgrade = (req, socket, head)=>{
            let server = this.#getServer(req);
            server && !this.wsInternalSubscribedServers.has(server) && this.handleUpgrade(req, socket, head);
        };
    }
    #getServer(req) {
        return req.socket?.server;
    }
    middleware = async (req, res, next)=>{
        if (this.shouldProxy(this.proxyOptions.pathFilter, req)) {
            let activeProxyOptions;
            try {
                if (!(activeProxyOptions = await this.prepareProxyRequest(req, res)).target && !activeProxyOptions.forward) throw Error('Must provide a proper URL as target');
            } catch (err) {
                next?.(err);
                return;
            }
            try {
                Debug("proxy request to target: %O", activeProxyOptions.target), await this.proxy.web(req, res, activeProxyOptions);
            } catch (err) {
                this.proxy.emit('error', err, req, res, activeProxyOptions.target), next?.(err);
            }
        } else next?.();
        let server = this.#getServer(req);
        server && !this.activeServers.has(server) && (Debug('registering server close listener'), this.activeServers.add(server), server.on('close', ()=>{
            (Debug('server close signal received.'), this.activeServers.delete(server), this.activeServers.size > 0) ? Debug(`proxy server not closed: ${this.activeServers.size} server(s) still active`) : (Debug('closing proxy server'), this.proxy.close(()=>Debug('proxy server closed')));
        })), !0 === this.proxyOptions.ws && server && this.catchUpgradeRequest(server);
    };
    registerPlugins(proxy, options) {
        getPlugins(options).forEach((plugin)=>{
            Debug(`register plugin: "${function_getFunctionName(plugin)}"`), plugin(proxy, options);
        });
    }
    catchUpgradeRequest = (server)=>{
        this.wsInternalSubscribedServers.has(server) || (Debug('subscribing to server upgrade event'), server.on('upgrade', this.handleUpgrade), this.wsInternalSubscribedServers.add(server));
    };
    handleUpgrade = async (req, socket, head)=>{
        try {
            if (this.shouldProxy(this.proxyOptions.pathFilter, req)) {
                let activeProxyOptions = await this.prepareProxyRequest(req, void 0);
                await this.proxy.ws(req, socket, activeProxyOptions, head), Debug('server upgrade event received. Proxying WebSocket');
            }
        } catch (err) {
            this.proxy.emit('error', err, req, socket);
        }
    };
    shouldProxy = (pathFilter, req)=>{
        try {
            return matchPathFilter(pathFilter, req.url, req);
        } catch (err) {
            return Debug('Error: matchPathFilter() called with request url: ', `"${req.url}"`), this.logger.error(err), !1;
        }
    };
    prepareProxyRequest = async (req, res)=>{
        let newProxyOptions = Object.assign({}, this.proxyOptions);
        return await this.applyRouter(req, res, newProxyOptions), normalizeIPv6LiteralTargets(newProxyOptions), await this.applyPathRewrite(req, res, this.pathRewriter, newProxyOptions), newProxyOptions;
    };
    applyRouter = async (req, res, options)=>{
        let newTarget;
        options.router && (newTarget = await getTarget(req, res, options)) && (Debug('router new target: "%s"', newTarget), options.target = newTarget);
    };
    applyPathRewrite = async (req, res, pathRewriter, options)=>{
        if (req.url && pathRewriter) {
            let path = await pathRewriter(req.url, req, res, options);
            'string' == typeof path ? (Debug('pathRewrite new path: %s', path), req.url = path) : Debug('pathRewrite: no rewritten path found: %s', req.url);
        }
    };
}
function createProxyMiddleware(options) {
    let { middleware } = new HttpProxyMiddleware(options);
    return middleware;
}
Debug.extend('response-interceptor');
export { createProxyMiddleware };
