import type { LoaderDefinition } from '@rspack/core';
type WorkerLoaderOptions = {
    name?: string;
};
declare const workerLoader: LoaderDefinition<WorkerLoaderOptions>;
export default workerLoader;
