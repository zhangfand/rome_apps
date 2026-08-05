import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";

const crons = cronJobs();

// Convex-native scheduling (no Rome routine needed for this one): hourly
// cleanup of expired browser read sessions.
crons.interval("prune expired read sessions", { hours: 1 }, internal.sessions.prune, {});

export default crons;
