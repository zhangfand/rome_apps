import { RscClientPlugin } from './RscClientPlugin.js';
import { RscServerPlugin, type RscServerPluginOptions } from './RscServerPlugin.js';
declare class ServerPlugin extends RscServerPlugin {
    constructor(options?: Omit<RscServerPluginOptions, 'coordinator'>);
}
declare class ClientPlugin extends RscClientPlugin {
}
export declare const rsc: {
    createPlugins: () => {
        ServerPlugin: new (options?: Omit<RscServerPluginOptions, 'coordinator'>) => ServerPlugin;
        ClientPlugin: new () => ClientPlugin;
    };
    Layers: {
        /**
         * The layer for server-only runtime and picking up `react-server` export conditions.
         */
        readonly rsc: 'react-server-components';
        /**
         * Server Side Rendering layer for app.
         */
        readonly ssr: 'server-side-rendering';
    };
};
export {};
