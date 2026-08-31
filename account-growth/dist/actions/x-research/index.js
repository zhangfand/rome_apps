import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createAppLogger, defineAction, z } from "@rome-os/app-runtime";
const execFileAsync = promisify(execFile);
const log = createAppLogger("account-growth:x_research");
const CDP_ENDPOINT = "http://127.0.0.1:9223";
const researchSchema = z.object({
    operation: z["enum"]([
        "search",
        "profile",
        "tweets"
    ]),
    query: z.string().trim().optional().describe("Search query when operation is search"),
    username: z.string().trim().optional().describe("X username when operation is profile or tweets"),
    limit: z.number().int().min(1).max(50).optional()
});
async function runOpenCli(args) {
    const { stdout } = await execFileAsync("opencli", [
        "--cdp-endpoint",
        CDP_ENDPOINT,
        "twitter",
        ...args,
        "-f",
        "json",
        "--window",
        "background",
        "--site-session",
        "persistent",
        "--keep-tab",
        "false"
    ], {
        timeout: 90000,
        maxBuffer: 6291456
    });
    return JSON.parse(stdout);
}
function createAction(config, _deps) {
    return defineAction({
        config,
        schema: researchSchema,
        execute: async ({ operation, query, username, limit = 15 })=>{
            try {
                let args;
                if ("search" === operation) {
                    if (!query) return {
                        status: "error",
                        error: "query is required for search"
                    };
                    args = [
                        "search",
                        query,
                        "--limit",
                        String(limit),
                        "--product",
                        "live",
                        "--exclude",
                        "retweets"
                    ];
                } else if ("profile" === operation) {
                    if (!username) return {
                        status: "error",
                        error: "username is required for profile"
                    };
                    args = [
                        "profile",
                        username.replace(/^@/, "")
                    ];
                } else {
                    if (!username) return {
                        status: "error",
                        error: "username is required for tweets"
                    };
                    args = [
                        "tweets",
                        username.replace(/^@/, ""),
                        "--limit",
                        String(limit),
                        "--page-delay",
                        "1"
                    ];
                }
                const data = await runOpenCli(args);
                return {
                    status: "ok",
                    data
                };
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                log.error("X research failed", {
                    operation,
                    error: message
                });
                return {
                    status: "error",
                    error: message
                };
            }
        }
    });
}
export { createAction };

//# sourceMappingURL=index.js.map