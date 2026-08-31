import type { InternalContext, RequestHandler, Rspack } from '../../types';
export declare function createAssetsMiddleware(context: InternalContext, ready: (callback: () => void) => void, outputFileSystem: Rspack.OutputFileSystem): RequestHandler;
