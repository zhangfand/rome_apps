import * as http from 'node:http';
import http__default, { ServerResponse, IncomingMessage } from 'node:http';
import * as net from 'node:net';
import net__default, { Socket } from 'node:net';
import http2, { Http2ServerResponse, Http2ServerRequest } from 'node:http2';
import { EventEmitter } from 'node:events';
import * as stream from 'node:stream';

interface ProxyTargetDetailed {
  host?: string;
  port?: number | string;
  protocol?: string;
  hostname?: string;
  socketPath?: string;
  key?: string;
  passphrase?: string;
  pfx?: Buffer | string;
  cert?: string;
  ca?: string;
  ciphers?: string;
  secureProtocol?: string;
}
type ProxyTarget = string | URL | ProxyTargetDetailed;
interface ProxyServerOptions {
  /** URL string to be parsed. */
  target?: ProxyTarget;
  /** URL string to be parsed. */
  forward?: ProxyTarget;
  /** Object to be passed to http(s).request. */
  agent?: any;
  /** Enable HTTP/2 listener, default is `false` */
  http2?: boolean;
  /** Object to be passed to https.createServer()
   * or http2.createSecureServer() if the `http2` option is enabled
   */
  ssl?: any;
  /** If you want to proxy websockets. */
  ws?: boolean;
  /** Adds x- forward headers. */
  xfwd?: boolean;
  /** Verify SSL certificate. */
  secure?: boolean;
  /** Explicitly specify if we are proxying to another proxy. */
  toProxy?: boolean;
  /** Specify whether you want to prepend the target's path to the proxy path. */
  prependPath?: boolean;
  /** Specify whether you want to ignore the proxy path of the incoming request. */
  ignorePath?: boolean;
  /** Local interface string to bind for outgoing connections. */
  localAddress?: string;
  /** Changes the origin of the host header to the target URL. */
  changeOrigin?: boolean;
  /** specify whether you want to keep letter case of response header key */
  preserveHeaderKeyCase?: boolean;
  /** Basic authentication i.e. 'user:password' to compute an Authorization header. */
  auth?: string;
  /** Rewrites the location hostname on (301 / 302 / 307 / 308) redirects, Default: null. */
  hostRewrite?: string;
  /** Rewrites the location host/ port on (301 / 302 / 307 / 308) redirects based on requested host/ port.Default: false. */
  autoRewrite?: boolean;
  /** Rewrites the location protocol on (301 / 302 / 307 / 308) redirects to 'http' or 'https'.Default: null. */
  protocolRewrite?: string;
  /** Rewrites domain of set-cookie headers. */
  cookieDomainRewrite?: false | string | {
    [oldDomain: string]: string;
  };
  /** Rewrites path of set-cookie headers. Default: false */
  cookiePathRewrite?: false | string | {
    [oldPath: string]: string;
  };
  /** Object with extra headers to be added to target requests. */
  headers?: {
    [header: string]: string;
  };
  /** Timeout (in milliseconds) when proxy receives no response from target. Default: 120000 (2 minutes) */
  proxyTimeout?: number;
  /** Timeout (in milliseconds) for incoming requests */
  timeout?: number;
  /** If set to true, none of the webOutgoing passes are called and it's your responsibility to appropriately return the response by listening and acting on the proxyRes event */
  selfHandleResponse?: boolean;
  /** Follow HTTP redirects from target. `true` = max 5 hops; number = custom max. */
  followRedirects?: boolean | number;
  /** Buffer */
  buffer?: stream.Stream;
}
type ResOfType<T extends "web" | "ws"> = T extends "ws" ? T extends "web" ? ServerResponse | Http2ServerResponse | Socket : Socket : T extends "web" ? ServerResponse | Http2ServerResponse : never;
type ProxyMiddleware<T extends ServerResponse | Http2ServerResponse | Socket> = (req: IncomingMessage | Http2ServerRequest, res: T, opts: ProxyServerOptions & {
  target: URL | ProxyTargetDetailed;
  forward: URL;
}, server: ProxyServer<IncomingMessage | Http2ServerRequest, ServerResponse | Http2ServerResponse>, head?: Buffer, callback?: (err: any, req: IncomingMessage | Http2ServerRequest, socket: T, url?: any) => void) => void | true;
interface ProxyServerEventMap<Req extends http__default.IncomingMessage | http2.Http2ServerRequest = http__default.IncomingMessage, Res extends http__default.ServerResponse | http2.Http2ServerResponse = http__default.ServerResponse> {
  error: [err: Error, req?: Req, res?: Res | net__default.Socket, target?: URL | ProxyTarget];
  start: [req: Req, res: Res, target: URL | ProxyTarget];
  econnreset: [err: Error, req: Req, res: Res, target: URL | ProxyTarget];
  proxyReq: [proxyReq: http__default.ClientRequest, req: Req, res: Res, options: ProxyServerOptions];
  proxyReqWs: [proxyReq: http__default.ClientRequest, req: Req, socket: net__default.Socket, options: ProxyServerOptions, head: any];
  proxyRes: [proxyRes: http__default.IncomingMessage, req: Req, res: Res];
  end: [req: Req, res: Res, proxyRes: http__default.IncomingMessage];
  open: [proxySocket: net__default.Socket];
  /** @deprecated */
  proxySocket: [proxySocket: net__default.Socket];
  close: [proxyRes: Req, proxySocket: net__default.Socket, proxyHead: any];
}
declare class ProxyServer<Req extends http__default.IncomingMessage | http2.Http2ServerRequest = http__default.IncomingMessage, Res extends http__default.ServerResponse | http2.Http2ServerResponse = http__default.ServerResponse> extends EventEmitter<ProxyServerEventMap<Req, Res>> {
  private _server?;
  _webPasses: ProxyMiddleware<http__default.ServerResponse>[];
  _wsPasses: ProxyMiddleware<net__default.Socket>[];
  options: ProxyServerOptions;
  web: (req: Req, res: Res, opts?: ProxyServerOptions, head?: any) => Promise<void>;
  ws: (req: Req, socket: net__default.Socket, opts: ProxyServerOptions, head?: any) => Promise<void>;
  /**
   * Creates the proxy server with specified options.
   * @param options - Config object passed to the proxy
   */
  constructor(options?: ProxyServerOptions);
  /**
   * A function that wraps the object in a webserver, for your convenience
   * @param port - Port to listen on
   * @param hostname - The hostname to listen on
   * @param listeningListener - A callback function that is called when the server starts listening
   */
  listen(port: number, hostname?: string, listeningListener?: () => void): this;
  /**
   * A function that closes the inner webserver and stops listening on given port
   */
  close(callback?: () => void): void;
  before<Type extends "ws" | "web">(type: Type, passName: string, pass: ProxyMiddleware<ResOfType<Type>>): void;
  after<Type extends "ws" | "web">(type: Type, passName: string, pass: ProxyMiddleware<ResOfType<Type>>): void;
  /** @internal */
  _getPasses<Type extends "ws" | "web">(type: Type): ProxyMiddleware<ResOfType<Type>>[];
}

/**
 * Based on definition by DefinitelyTyped:
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/6f529c6c67a447190f86bfbf894d1061e41e07b7/types/http-proxy-middleware/index.d.ts
 */

type NextFunction<T = (err?: any) => void> = T;
interface RequestHandler<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse, TNext = NextFunction> {
    (req: TReq, res: TRes, next?: TNext): Promise<void>;
    upgrade: (req: TReq, socket: net.Socket, head: Buffer) => void;
}
type Filter<TReq extends http.IncomingMessage = http.IncomingMessage> = string | string[] | ((pathname: string, req: TReq) => boolean);
interface Plugin<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse> {
    (proxyServer: ProxyServer<TReq, TRes>, options: Options<TReq, TRes>): void;
}
interface OnProxyEvent<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse> {
    error?: (err: Error, req: TReq, res: TRes | net.Socket, target?: string | Partial<URL>) => void;
    proxyReq?: (proxyReq: http.ClientRequest, req: TReq, res: TRes, options: ProxyServerOptions) => void;
    proxyReqWs?: (proxyReq: http.ClientRequest, req: TReq, socket: net.Socket, options: ProxyServerOptions, head: any) => void;
    proxyRes?: (proxyRes: TReq, req: TReq, res: TRes) => void | Promise<void>;
    open?: (proxySocket: net.Socket) => void;
    close?: (proxyRes: TReq, proxySocket: net.Socket, proxyHead: any) => void;
    start?: (req: TReq, res: TRes, target: string | Partial<URL>) => void;
    end?: (req: TReq, res: TRes, proxyRes: TReq) => void;
    econnreset?: (err: Error, req: TReq, res: TRes, target: string | Partial<URL>) => void;
}
type Logger = Pick<Console, 'info' | 'warn' | 'error'>;
type PathRewriteConfig<TReq extends http.IncomingMessage = http.IncomingMessage> = {
    [regexp: string]: string;
} | ((path: string, req: TReq) => string | undefined) | ((path: string, req: TReq) => Promise<string>);
interface Options<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse> extends ProxyServerOptions {
    /**
     * Narrow down requests to proxy or not.
     * Filter on {@link http.IncomingMessage.url `pathname`} which is relative to the proxy's "mounting" point in the server.
     * Or use the {@link http.IncomingMessage `req`}  object for more complex filtering.
     * @link https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/pathFilter.md
     * @since v3.0.0
     */
    pathFilter?: Filter<TReq>;
    /**
     * Modify request paths before requests are send to the target.
     * @example
     * ```js
     * createProxyMiddleware({
     *   pathRewrite: {
     *     '^/api/old-path': '/api/new-path', // rewrite path
     *   }
     * });
     * ```
     * @link https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/pathRewrite.md
     */
    pathRewrite?: PathRewriteConfig<TReq>;
    /**
     * Access the internal `httpxy` server instance to customize behavior
     *
     * @example
     * ```js
     * createProxyMiddleware({
     *   plugins: [(proxyServer, options) => {
     *     proxyServer.on('error', (error, req, res) => {
     *       console.error(error);
     *     });
     *   }]
     * });
     * ```
     * @link https://github.com/chimurai/http-proxy-middleware#plugins-array
     * @since v3.0.0
     */
    plugins?: Plugin<TReq, TRes>[];
    /**
     * Eject pre-configured plugins.
     * NOTE: register your own error handlers to prevent server from crashing.
     *
     * @link https://github.com/chimurai/http-proxy-middleware#ejectplugins-boolean-default-false
     * @since v3.0.0
     */
    ejectPlugins?: boolean;
    /**
     * Listen to `httpxy` events
     * @see {@link OnProxyEvent} for available events
     * @example
     * ```js
     * createProxyMiddleware({
     *   on: {
     *     error: (error, req, res, target) => {
     *       console.error(error);
     *     }
     *   }
     * });
     * ```
     * @link https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/proxy-events.md
     * @since v3.0.0
     */
    on?: OnProxyEvent<TReq, TRes>;
    /**
     * Dynamically set the {@link Options.target `options.target`}.
     * @example
     * ```js
     * createProxyMiddleware({
     *   router: async (req) => {
     *     return 'http://127:0.0.1:3000';
     *   }
     * });
     * ```
     * @link https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/router.md
     */
    router?: Record<string, ProxyServerOptions['target']> | ((req: TReq) => ProxyServerOptions['target']) | ((req: TReq) => Promise<ProxyServerOptions['target']>);
    /**
     * Log information from http-proxy-middleware
     * @example
     * ```js
     * createProxyMiddleware({
     *  logger: console
     * });
     * ```
     * @link https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/logger.md
     * @since v3.0.0
     */
    logger?: Logger;
}

/**
 * Create proxy middleware for Express-like servers. ([list of servers with examples](https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/servers.md))
 *
 * @example Basic proxy to a single target.
 * ```ts
 * import { createProxyMiddleware } from 'http-proxy-middleware';
 *
 * const proxy = createProxyMiddleware({
 *   target: 'http://www.example.org',
 *   changeOrigin: true,
 * });
 * ```
 *
 * @example Proxy only matching paths and rewrite the forwarded path.
 * ```ts
 * import { createProxyMiddleware } from 'http-proxy-middleware';
 *
 * const proxy = createProxyMiddleware({
 *   target: 'http://localhost:3000',
 *   pathFilter: '/api',
 *   pathRewrite: {
 *     '^/api/': '/',
 *   },
 * });
 * ```
 *
 * @example Native path rewrite by mounting at a route (alternative to `pathRewrite`).
 * ```ts
 * import express from 'express';
 * import { createProxyMiddleware } from 'http-proxy-middleware';
 *
 * const app = express();
 * app.use(
 *   '/users',
 *   createProxyMiddleware({
 *     target: 'http://jsonplaceholder.typicode.com/users',
 *     changeOrigin: true,
 *   }),
 * );
 * ```
 *
 * @example Use framework-specific request/response types (Express).
 * ```ts
 * import type { Request, Response } from 'express';
 * import { createProxyMiddleware } from 'http-proxy-middleware';
 *
 * const proxy = createProxyMiddleware<Request, Response>({
 *   target: 'http://www.example.org/api',
 *   changeOrigin: true,
 * });
 * ```
 *
 * @example Intercept and modify a proxied response body.
 * ```ts
 * import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
 *
 * const proxy = createProxyMiddleware({
 *   target: 'http://www.example.org',
 *   selfHandleResponse: true,
 *   on: {
 *     proxyRes: responseInterceptor(async (responseBuffer) => {
 *       const response = responseBuffer.toString('utf8');
 *       return response.replace('Hello', 'Goodbye');
 *     }),
 *   },
 * });
 * ```
 *
 * @see https://github.com/chimurai/http-proxy-middleware/
 * @see https://github.com/chimurai/http-proxy-middleware/#basic-usage
 * @see https://github.com/chimurai/http-proxy-middleware/#intercept-and-manipulate-responses
 * @see https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/servers.md
 * @see https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/pathFilter.md
 * @see https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/pathRewrite.md
 * @see https://github.com/chimurai/http-proxy-middleware/blob/master/recipes/response-interceptor.md
 */
declare function createProxyMiddleware<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse, TNext = NextFunction>(options: Options<TReq, TRes>): RequestHandler<TReq, TRes, TNext>;

type Interceptor<TReq = http.IncomingMessage, TRes = http.ServerResponse> = (buffer: Buffer, proxyRes: http.IncomingMessage, req: TReq, res: TRes) => Promise<Buffer | string>;
/**
 * Intercept responses from upstream.
 * Automatically decompress (deflate, gzip, brotli).
 * Give developer the opportunity to modify intercepted Buffer and http.ServerResponse
 *
 * NOTE: must set options.selfHandleResponse=true (prevent automatic call of res.end())
 */
declare function responseInterceptor<TReq extends http.IncomingMessage = http.IncomingMessage, TRes extends http.ServerResponse = http.ServerResponse>(interceptor: Interceptor<TReq, TRes>): (proxyRes: http.IncomingMessage, req: TReq, res: TRes) => Promise<void>;

type BodyParserLikeRequest = http.IncomingMessage & {
    body?: any;
};
/**
 * Fix proxied body if bodyParser is involved.
 */
declare function fixRequestBody<TReq extends BodyParserLikeRequest = BodyParserLikeRequest>(proxyReq: http.ClientRequest, req: TReq): void;

/**
 * Subscribe to {@link https://github.com/unjs/httpxy#events `httpxy` error events} to prevent server from crashing.
 * Errors are logged with {@link https://www.npmjs.com/package/debug debug} library.
 */
declare const debugProxyErrorsPlugin: Plugin;

declare const errorResponsePlugin: Plugin;

declare const loggerPlugin: Plugin;

/**
 * Implements option.on object to subscribe to `httpxy` events.
 *
 * @example
 * ```js
 * createProxyMiddleware({
 *  on: {
 *    error: (error, req, res, target) => {},
 *    proxyReq: (proxyReq, req, res, options) => {},
 *    proxyReqWs: (proxyReq, req, socket, options) => {},
 *    proxyRes: (proxyRes, req, res) => {},
 *    open: (proxySocket) => {},
 *    close: (proxyRes, proxySocket, proxyHead) => {},
 *    start: (req, res, target) => {},
 *    end: (req, res, proxyRes) => {},
 *    econnreset: (error, req, res, target) => {},
 *  }
 * });
 * ```
 */
declare const proxyEventsPlugin: Plugin;

export { createProxyMiddleware, debugProxyErrorsPlugin, errorResponsePlugin, fixRequestBody, loggerPlugin, proxyEventsPlugin, responseInterceptor };
export type { Filter, Options, Plugin, RequestHandler };
