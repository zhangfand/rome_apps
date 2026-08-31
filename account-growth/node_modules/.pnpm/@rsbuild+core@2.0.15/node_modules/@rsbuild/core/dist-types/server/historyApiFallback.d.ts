/**
 * This module is modified based on source found in
 * https://github.com/bripkens/connect-history-api-fallback
 *
 * MIT Licensed
 * Copyright (c) 2022 Ben Blackmore and contributors
 * https://github.com/bripkens/connect-history-api-fallback/blob/master/LICENSE
 */ import type { Logger } from '../logger';
import type { HistoryApiFallbackOptions, RequestHandler } from '../types';
export declare function historyApiFallbackMiddleware(logger: Logger, options?: HistoryApiFallbackOptions): RequestHandler;
