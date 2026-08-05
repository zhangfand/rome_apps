import type { StatsError } from '@rspack/core';
import { type Logger } from '../logger';
// Formats Rspack stats error to readable message
export declare function formatStatsError(stats: StatsError, root: string, level: 'error' | 'warning' | undefined, logger: Logger): string;
