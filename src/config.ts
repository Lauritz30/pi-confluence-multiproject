import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_FILE_NAME = "pi-confluence-multiproject.json";

export type SafetyLevel = "open" | "confirm" | "readonly";

export interface HeadlessApprovalRule {
  action: string;
  spaceKey?: string;
  pageIds?: string[];
}

export interface ConfluenceSiteConfig {
  name: string;
  url: string;
  email: string;
  apiToken?: string;
  safetyLevel?: SafetyLevel;
  headlessApprovals?: HeadlessApprovalRule[];
}

export interface ConfluenceConfig {
  sites: ConfluenceSiteConfig[];
  defaultSite?: string;
  safetyLevel: SafetyLevel;
  mock: boolean;
  configPath: string;
  configExists: boolean;
}

interface RawSite {
  name?: unknown;
  url?: unknown;
  email?: unknown;
  apiToken?: unknown;
  safetyLevel?: unknown;
  headlessApprovals?: unknown;
}

export class ConfigError extends Error {}

export function getConfigPath(): string {
  return join(homedir(), ".pi", "agent", CONFIG_FILE_NAME);
}

export function loadConfig(path: string = getConfigPath()): ConfluenceConfig {
  if (!existsSync(path)) {
    return {
      sites: [],
      defaultSite: undefined,
      safetyLevel: "confirm",
      mock: false,
      configPath: path,
      configExists: false,
    };
  }

  let raw: { sites?: unknown; defaultSite?: unknown; safetyLevel?: unknown; mock?: unknown };
  try {
    raw = JSON.parse(readFileSync(path, "utf8")) as typeof raw;
  } catch (error) {
    throw new ConfigError(`Failed to parse ${path}: ${(error as Error).message}`);
  }

  const sites = Array.isArray(raw.sites) ? (raw.sites as RawSite[]) : [];
  for (const site of sites) {
    if (!site.name) throw new ConfigError(`Config ${path}: every entry in "sites" requires a "name".`);
    if (!site.url) throw new ConfigError(`Config ${path}: site "${site.name}" requires a "url".`);
    if (!site.email) throw new ConfigError(`Config ${path}: site "${site.name}" requires an "email".`);
    if (!site.apiToken && !raw.mock) throw new ConfigError(`Config ${path}: site "${site.name}" requires an "apiToken".`);

    if (site.headlessApprovals !== undefined && !Array.isArray(site.headlessApprovals)) {
      throw new ConfigError(`Config ${path}: site "${site.name}" field "headlessApprovals" must be an array.`);
    }

    for (const rule of site.headlessApprovals ?? []) {
      if (!rule || typeof rule !== "object" || typeof (rule as { action?: unknown }).action !== "string") {
        throw new ConfigError(`Config ${path}: every "headlessApprovals" entry for site "${site.name}" requires an "action" string.`);
      }
      const typedRule = rule as { spaceKey?: unknown; pageIds?: unknown };
      if (typedRule.spaceKey !== undefined && typeof typedRule.spaceKey !== "string") {
        throw new ConfigError(`Config ${path}: "headlessApprovals.spaceKey" for site "${site.name}" must be a string.`);
      }
      if (typedRule.pageIds !== undefined && (!Array.isArray(typedRule.pageIds) || !typedRule.pageIds.every((id) => typeof id === "string"))) {
        throw new ConfigError(`Config ${path}: "headlessApprovals.pageIds" for site "${site.name}" must be an array of strings.`);
      }
    }
  }

  const parsedSites: ConfluenceSiteConfig[] = sites.map((site) => ({
    name: String(site.name),
    url: String(site.url),
    email: String(site.email),
    ...(site.apiToken !== undefined ? { apiToken: String(site.apiToken) } : {}),
    ...(site.safetyLevel !== undefined ? { safetyLevel: site.safetyLevel as SafetyLevel } : {}),
    ...(Array.isArray(site.headlessApprovals)
      ? {
          headlessApprovals: site.headlessApprovals.map((rule) => {
            const typedRule = rule as { action: string; spaceKey?: string; pageIds?: string[] };
            return {
              action: typedRule.action,
              ...(typedRule.spaceKey !== undefined ? { spaceKey: typedRule.spaceKey } : {}),
              ...(typedRule.pageIds !== undefined ? { pageIds: typedRule.pageIds } : {}),
            };
          }),
        }
      : {}),
  }));

  return {
    sites: parsedSites,
    defaultSite: typeof raw.defaultSite === "string" ? raw.defaultSite : parsedSites[0]?.name,
    safetyLevel: raw.safetyLevel === "open" || raw.safetyLevel === "readonly" ? raw.safetyLevel : "confirm",
    mock: Boolean(raw.mock),
    configPath: path,
    configExists: true,
  };
}

export function resolveSite(config: ConfluenceConfig, name?: string): ConfluenceSiteConfig {
  const siteName = name ?? config.defaultSite;
  if (!siteName) {
    throw new ConfigError(`No Confluence site configured. Add one to ${config.configPath} (see README.md).`);
  }

  const site = config.sites.find((s) => s.name === siteName);
  if (!site) {
    const known = config.sites.map((s) => s.name).join(", ") || "(none configured)";
    throw new ConfigError(`Unknown Confluence site "${siteName}". Configured sites: ${known}.`);
  }

  return site;
}

export function resolveSafetyLevel(
  config: Pick<ConfluenceConfig, "safetyLevel">,
  site?: Pick<ConfluenceSiteConfig, "safetyLevel">,
): SafetyLevel {
  return site?.safetyLevel ?? config.safetyLevel ?? "confirm";
}
