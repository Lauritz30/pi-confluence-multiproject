/** Build Atlassian Basic auth header from email + API token. */
export function buildBasicAuthHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64");
  return `Basic ${encoded}`;
}
