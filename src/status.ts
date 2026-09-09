import { Box, Text } from "@earendil-works/pi-tui";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveSafetyLevel, type ConfluenceConfig, type ConfluenceSiteConfig } from "./config.ts";

const ENTRY_TYPE = "pi-confluence-multiproject:connection";

export interface ConnectionCardData {
  configured: boolean;
  site?: string;
  url?: string;
  email?: string;
  safetyLevel?: string;
  configPath: string;
}

export interface StatusUi {
  ui: {
    setStatus(key: string, text: string | undefined): void;
  };
}

export function buildFooterLabel(config: ConfluenceConfig, site: ConfluenceSiteConfig | undefined): string {
  if (!site) return "Confluence · not configured";
  const safetyLevel = resolveSafetyLevel(config, site);
  return `✓ Confluence · ${site.name} (${safetyLevel})`;
}

export function publishFooterStatus(ctx: StatusUi, config: ConfluenceConfig, site: ConfluenceSiteConfig | undefined): void {
  ctx.ui.setStatus("pi-confluence-multiproject", buildFooterLabel(config, site));
}

export function publishConnectionCard(pi: ExtensionAPI, config: ConfluenceConfig, site: ConfluenceSiteConfig | undefined): void {
  pi.appendEntry<ConnectionCardData>(ENTRY_TYPE, {
    configured: Boolean(site),
    site: site?.name,
    url: site?.url,
    email: site?.email,
    safetyLevel: site ? resolveSafetyLevel(config, site) : undefined,
    configPath: config.configPath,
  });
}

export function registerConnectionCardRenderer(pi: ExtensionAPI): void {
  pi.registerEntryRenderer<ConnectionCardData>(ENTRY_TYPE, (entry) => {
    const data = entry.data;
    const box = new Box(1, 1);
    if (!data?.configured) {
      box.addChild(new Text(`Confluence: not configured${data ? ` (see ${data.configPath})` : ""}`));
      return box;
    }

    box.addChild(new Text(`Confluence · ${data.site ?? "?"} · ${data.email ?? "?"} · safetyLevel=${data.safetyLevel ?? "?"}`));
    box.addChild(new Text(data.url ?? ""));
    return box;
  });
}
