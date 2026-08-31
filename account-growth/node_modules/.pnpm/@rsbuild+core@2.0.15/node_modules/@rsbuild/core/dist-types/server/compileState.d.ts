export declare const createCompileState: (environmentCount: number) => {
    reset(index: number): void;
    done(index: number, nextStats: Rspack.Stats): void;
    wait(index: number): Promise<Rspack.Stats>;
};
