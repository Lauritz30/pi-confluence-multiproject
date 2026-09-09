import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite } from "../config.ts";
import { createConfluenceClient } from "../client.ts";
import { errorResult, textResult, type ToolResult } from "./shared.ts";

const parameters = Type.Object({
  site: Type.Optional(Type.String({ description: "Site name to check; defaults to defaultSite." })),
});
type Params = Static<typeof parameters>;

export async function runDoctor(params: Params): Promise<ToolResult> {
  const config = loadConfig();

  if (!config.configExists) {
    return textResult(
      `No Confluence config found at ${config.configPath}. Create it with at least one entry under "sites" (see README.md).`,
      { configured: false, configPath: config.configPath },
    );
  }

  let site;
  try {
    site = resolveSite(config, params.site);
  } catch (error) {
    return errorResult((error as Error).message);
  }

  if (config.mock) {
    return textResult(
      `Mock mode enabled. Site "${site.name}" (${site.url}) resolved from config; no live Confluence request made.`,
      { configured: true, mock: true, site: site.name },
    );
  }

  const client = createConfluenceClient(site);
  const result = await client.get("/spaces", { query: { limit: 1 } });
  const count = Array.isArray(result?.results) ? result.results.length : 0;
  return textResult(`Connected to ${site.url}. Confluence API reachable (sampled ${count} space record(s)).`, {
    configured: true,
    mock: false,
    site: site.name,
  });
}

export function createDoctorTool(): ToolDefinition<any, any, any> {
  return {
    name: "confluence_doctor",
    label: "Confluence Doctor",
    description: "Check Confluence configuration and connectivity (config file, site resolution, authentication).",
    promptSnippet: "Verify Confluence configuration and connection health",
    parameters,
    async execute(_toolCallId: string, params: Params) {
      return runDoctor(params);
    },
  };
}
