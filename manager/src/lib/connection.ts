const CONNECTION_REQUIRED = [
  /not signed in/i,
  /connector_login/i,
  /not connected/i,
  /not.connected/i,
  /\b401\b/,
  /\b403\b/,
  /unauthor/i,
  /authentication/i,
  /bad credentials/i,
  /connect github/i,
  /github connection/i,
];

export function isConnectionRequiredMessage(message: string): boolean {
  return CONNECTION_REQUIRED.some((pattern) => pattern.test(message));
}
