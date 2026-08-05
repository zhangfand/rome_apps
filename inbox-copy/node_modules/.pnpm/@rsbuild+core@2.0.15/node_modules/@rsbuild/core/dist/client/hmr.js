import { logger } from "./60.js";
let createOverlay;
let clearOverlay;
const getErrorField = (error, field)=>{
    if (error instanceof Error) {
        const value = error[field];
        return void 0 === value ? void 0 : String(value);
    }
};
const formatErrorLikeMessage = (error)=>{
    if (!(error instanceof Error)) return;
    const message = getErrorField(error, 'message');
    if (void 0 === message) return;
    const name = getErrorField(error, 'name');
    return name ? `${name}: ${message}` : message;
};
function setupCustomHMRListeners(customListenersMap) {
    __webpack_require__.i.push(({ module })=>{
        const newListeners = new Map();
        const addToMap = (map, event, cb)=>{
            const existing = map.get(event) || [];
            existing.push(cb);
            map.set(event, existing);
        };
        module.hot.on = (event, cb)=>{
            addToMap(customListenersMap, event, cb);
            addToMap(newListeners, event, cb);
        };
        module.hot.dispose(()=>{
            for (const [event, staleFns] of newListeners){
                const listeners = customListenersMap.get(event);
                if (listeners) customListenersMap.set(event, listeners.filter((l)=>!staleFns.includes(l)));
            }
        });
    });
}
const registerOverlay = (createFn, clearFn)=>{
    createOverlay = createFn;
    clearOverlay = clearFn;
};
function init(token, config, serverHost, serverPort, serverBase, liveReload, browserLogs, logLevel, resolveWebSocketUrl) {
    logger.level = logLevel;
    const queuedMessages = [];
    const clientErrors = [];
    const customListenersMap = new Map();
    let lastHash;
    let hasBuildErrors = false;
    const base = serverBase.endsWith('/') ? serverBase : `${serverBase}/`;
    function formatURL(fallback) {
        const { location: location1 } = self;
        const hostname = (fallback ? serverHost : config.host) || location1.hostname;
        const port = (fallback ? serverPort : config.port) || location1.port;
        const protocol = config.protocol || ('https:' === location1.protocol ? 'wss' : 'ws');
        const pathname = config.path;
        if ("u" > typeof URL) {
            const url = new URL('http://localhost');
            url.port = String(port);
            url.hostname = hostname;
            url.protocol = protocol;
            url.pathname = pathname;
            url.searchParams.append('token', token);
            return url.toString();
        }
        const colon = -1 === protocol.indexOf(':') ? ':' : '';
        return `${protocol}${colon}//${hostname}:${port}${pathname}?token=${token}`;
    }
    function getSocketURL(fallback) {
        const url = formatURL(fallback);
        return resolveWebSocketUrl ? resolveWebSocketUrl(url) : url;
    }
    function clearBuildErrors() {
        if (console.clear && hasBuildErrors) console.clear();
        hasBuildErrors = false;
    }
    function handleSuccess() {
        clearBuildErrors();
        tryApplyUpdates();
    }
    function handleWarnings({ text }) {
        clearBuildErrors();
        for(let i = 0; i < text.length; i++){
            if (5 === i) {
                logger.warn('[rsbuild] Additional warnings detected. View complete log in terminal for details.');
                break;
            }
            logger.warn(text[i]);
        }
        tryApplyUpdates();
    }
    function handleErrors({ text, html }) {
        clearBuildErrors();
        hasBuildErrors = true;
        for (const error of text)logger.error(error);
        const { overlay } = config;
        if (createOverlay && (true === overlay || 'object' == typeof overlay && false !== overlay.errors)) if (html) createOverlay('Build failed', html);
        else null == clearOverlay || clearOverlay();
    }
    function handleResolvedClientError({ id, message }) {
        if (!createOverlay || hasBuildErrors) return;
        for (const item of clientErrors)if (item.id === id) item.message = message;
        createOverlay('Runtime errors', clientErrors.map((item)=>item.message).filter(Boolean).join('\n\n'));
    }
    const shouldUpdate = ()=>lastHash !== __webpack_hash__;
    const handleApplyUpdates = (err, updatedModules)=>{
        const forcedReload = err || !updatedModules;
        if (forcedReload) {
            if (err) logger.error('[rsbuild] HMR update failed, performing full reload:', err);
            fullReload();
            return;
        }
        tryApplyUpdates();
    };
    function tryApplyUpdates() {
        if (!shouldUpdate()) return;
        if (import.meta.webpackHot) {
            if ('idle' !== import.meta.webpackHot.status()) return;
            import.meta.webpackHot.check(true).then((updatedModules)=>{
                handleApplyUpdates(null, updatedModules);
            }, (err)=>{
                handleApplyUpdates(err, null);
            });
            return;
        }
        fullReload();
    }
    let socket = null;
    let reconnectCount = 0;
    let pingIntervalId;
    const isSocketReady = ()=>socket && socket.readyState === socket.OPEN;
    const socketSend = (data)=>{
        if (isSocketReady()) socket.send(JSON.stringify(data));
    };
    function onOpen() {
        logger.info('[rsbuild] WebSocket connected.');
        reconnectCount = 0;
        pingIntervalId = setInterval(()=>{
            socketSend({
                type: 'ping'
            });
        }, 30000);
        if (queuedMessages.length) {
            queuedMessages.forEach(socketSend);
            queuedMessages.length = 0;
        }
    }
    function onMessage(e) {
        const message = JSON.parse(e.data);
        switch(message.type){
            case 'hash':
                lastHash = message.data;
                if (clearOverlay && shouldUpdate()) clearOverlay();
                break;
            case 'ok':
                handleSuccess();
                break;
            case 'full-reload':
                fullReload(message.data);
                break;
            case 'static-changed':
                fullReload();
                break;
            case 'warnings':
                handleWarnings(message.data);
                break;
            case 'errors':
                handleErrors(message.data);
                break;
            case 'resolved-client-error':
                handleResolvedClientError(message.data);
                break;
            case 'custom':
                {
                    const { event, data } = message.data;
                    if (event) {
                        const cbs = customListenersMap.get(event);
                        if (cbs) cbs.forEach((cb)=>{
                            cb(data);
                        });
                    }
                    break;
                }
        }
    }
    function onClose() {
        if (reconnectCount >= config.reconnect) {
            if (config.reconnect > 0) logger.warn('[rsbuild] WebSocket connection failed after maximum retry attempts.');
            return;
        }
        if (0 === reconnectCount) logger.info('[rsbuild] WebSocket connection lost. Reconnecting...');
        removeListeners();
        socket = null;
        reconnectCount++;
        setTimeout(connect, 1000 * 1.5 ** reconnectCount);
    }
    function onSocketError() {
        if (resolveWebSocketUrl) return;
        if (getSocketURL() !== getSocketURL(true)) {
            logger.error('[rsbuild] WebSocket connection failed. Trying direct connection fallback.');
            removeListeners();
            socket = null;
            connect(true);
        }
    }
    function sendError(message, error) {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        const messageInfo = {
            type: 'client-error',
            id,
            message,
            name: getErrorField(error, 'name'),
            stack: getErrorField(error, 'stack')
        };
        clientErrors.push({
            id
        });
        if (isSocketReady()) socketSend(messageInfo);
        else queuedMessages.push(messageInfo);
    }
    function onUnhandledRejection({ reason }) {
        let message;
        const errorMessage = formatErrorLikeMessage(reason);
        if (void 0 !== errorMessage) message = errorMessage;
        else if ('string' == typeof reason) message = reason;
        else try {
            message = JSON.stringify(reason);
        } catch (unused) {
            return;
        }
        sendError(`Uncaught (in promise) ${message}`, reason);
    }
    function connect(fallback = false) {
        if (0 === reconnectCount) logger.info('[rsbuild] WebSocket connecting...');
        const socketUrl = getSocketURL(fallback);
        socket = new WebSocket(socketUrl);
        socket.addEventListener('open', onOpen);
        socket.addEventListener('close', onClose);
        socket.addEventListener('message', onMessage);
        if (!fallback) socket.addEventListener('error', onSocketError);
    }
    function removeListeners() {
        clearInterval(pingIntervalId);
        if (socket) {
            socket.removeEventListener('open', onOpen);
            socket.removeEventListener('close', onClose);
            socket.removeEventListener('message', onMessage);
            socket.removeEventListener('error', onSocketError);
        }
    }
    function fullReload(data) {
        if (!liveReload) return;
        const path = null == data ? void 0 : data.path;
        if (null == path ? void 0 : path.endsWith('.html')) {
            const pathname = decodeURI(location.pathname);
            const targetPath = base + path.slice(1);
            const targetPathWithoutExt = targetPath.slice(0, -5);
            if (pathname === targetPath || pathname === targetPathWithoutExt || pathname.endsWith('/') && `${pathname}index.html` === targetPath) location.reload();
            return;
        }
        location.reload();
    }
    if (browserLogs && "u" > typeof window) {
        window.addEventListener('error', ({ message, error })=>{
            sendError(message, error);
        });
        window.addEventListener('unhandledrejection', onUnhandledRejection);
    }
    if (import.meta.webpackHot) setupCustomHMRListeners(customListenersMap);
    connect();
}
export { init, registerOverlay };
