import { parseArgs } from "node:util";
import { CliError, DEFAULT_HOST, saveConfig } from "./config.js";
import { extractSessionToken, postJson } from "./api.js";
import { promptLine, promptSecret } from "./prompt.js";

const HELP = `Usage: rome login [options]

  --host <url>           Rome App Store base URL (default: ${DEFAULT_HOST})
  --email <email>        Account email
  --password <pw>        Password (insecure — prefer prompt or stdin)
  --password-stdin       Read password from stdin (no echo)
  --help, -h             Show this help

If --host is omitted, defaults to ROME_STORE_HOST env var, then ${DEFAULT_HOST}.
The session token is stored in ~/.rome/store-token.json with mode 0600.`;

interface LoginResponse {
  user: { id: string; email: string; slug: string; isAdmin: boolean };
}

export async function runLogin(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      host: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      "password-stdin": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    return;
  }

  const host = values.host ?? process.env.ROME_STORE_HOST ?? DEFAULT_HOST;

  const email = values.email ?? (await promptLine("Email: "));
  if (!email) throw new CliError("email is required");

  let password = values.password;
  if (!password && values["password-stdin"]) {
    password = await promptSecret("");
  }
  if (!password) password = await promptSecret("Password: ");
  if (!password) throw new CliError("password is required");

  const { body, setCookies } = await postJson<LoginResponse>(host, "/api/auth/login", {
    email,
    password,
  });

  const token = extractSessionToken(setCookies);
  if (!token) {
    throw new CliError("Login succeeded but no session cookie was returned by the server");
  }

  const file = await saveConfig({ host, email: body.user.email, token });
  process.stdout.write(`Logged in as ${body.user.email}. Saved to ${file}\n`);
}
