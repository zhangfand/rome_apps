import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import type { DevConfig, InternalContext, Rspack } from '../types';
export type ServerMessageFullReload = {
    type: 'full-reload';
    data?: {
        /**
     * If `path` ends with `.html`, only the matching page will reload.
     * The HTML path should be relative to the dev server root and should not
     * include `server.base`. Use `'*'` to reload all pages.
     * @example `/foo.html`
     */ path?: string;
    };
};
export type ServerMessageStaticChanged = {
    type: 'static-changed';
};
export type ServerMessageHash = {
    type: 'hash';
    data: string;
};
export type ServerMessageOk = {
    type: 'ok';
};
export type ServerMessageWarnings = {
    type: 'warnings';
    data: {
        text: string[];
    };
};
export type ServerMessageErrors = {
    type: 'errors';
    data: {
        text: string[];
        html: string;
    };
};
export type ServerMessageResolvedClientError = {
    type: 'resolved-client-error';
    data: {
        id: string;
        message: string;
    };
};
export type ServerCustomMessage = {
    type: 'custom';
    data: {
        event: string;
        data?: any;
    };
};
export type ServerMessage = ServerMessageOk | ServerMessageFullReload | ServerMessageStaticChanged | ServerMessageHash | ServerMessageWarnings | ServerMessageErrors | ServerMessageResolvedClientError | ServerCustomMessage;
export type ClientMessageError = {
    type: 'client-error';
    id: string;
    message: string;
    name?: string;
    stack?: string;
};
export type ClientMessagePing = {
    type: 'ping';
};
export type ClientMessage = ClientMessagePing | ClientMessageError;
export declare class SocketServer {
    private wsServer;
    private readonly socketsMap;
    private readonly options;
    private readonly context;
    private initialChunksMap;
    private heartbeatTimer;
    private getOutputFileSystem;
    private reportedBrowserLogs;
    private currentHash;
    constructor(context: InternalContext, options: DevConfig, getOutputFileSystem: () => Rspack.OutputFileSystem);
    // subscribe upgrade event to handle socket
    upgrade: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
    // detect and close broken connections
    // https://github.com/websockets/ws/blob/8.18.0/README.md#how-to-detect-and-close-broken-connections
    private checkSockets;
    private clearHeartbeatTimer;
    // create socket, install socket handler, bind socket event
    prepare(): Promise<void>;
    onBuildDone(): void;
    /**
   * Send error messages to the client.
   */ sendError(errors: Rspack.StatsError[], token: string): void;
    /**
   * Send warning messages to the client
   */ sendWarning(warnings: Rspack.StatsError[], token: string): void;
    /**
   * Send a server message to matching client sockets.
   * @param message - The message to send
   * @param token - The token of the socket to send the message to,
   * if not provided, the message will be sent to all sockets
   */ sendMessage(message: ServerMessage, token?: string): void;
    close(): Promise<void>;
    private onConnect;
    private getEnvironmentByToken;
    private getInitialChunks;
    // Cache initial chunks for environments that have no baseline yet.
    // This keeps comparison stable even when no client socket is connected
    // during the first completed build.
    private ensureInitialChunks;
    // Only use stats when environment is matched
    private getStats;
    // determine what message should send by stats
    private sendStats;
    // send a serialized message to a specific socket
    private sendRawMessage;
}
