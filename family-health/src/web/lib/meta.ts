import { createContext, useContext } from "react";
import type { Meta } from "./types";

export const MetaContext = createContext<Meta | null>(null);
export const useMeta = () => useContext(MetaContext);
