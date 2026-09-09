import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite, type ConfluenceConfig, type ConfluenceSiteConfig } from "./config.ts";
import { createDoctorTool, runDoctor } from "./tools/doctor.ts";
import { createReadTools } from "./tools/read.ts";
import { createWriteTools } from "./tools/write.ts";
import { publishFooterStatus, publishConnectionCard, registerConnectionCardRenderer, type StatusUi } from "./status.ts";

export default function piConfluenceMultiproject(pi: ExtensionAPI) {
  pi.registerTool(createDoctorTool());
  for (const tool of createReadTools()) pi.registerTool(tool);
  for (const tool of createWriteTools()) pi.registerTool(tool);

  registerConnectionCardRenderer(pi);

  function refreshStatus(ctx: StatusUi) {
    const config: ConfluenceConfig = loadConfig();
    let site: ConfluenceSiteConfig | undefined;
    try {
      site = resolveSite(config);
    } catch {
      site = undefined;
    }
    publishFooterStatus(ctx, config, site);
    publishConnectionCard(pi, config, site);
  }

  pi.on("session_start", async (_event, ctx) => {
    refreshStatus(ctx);
  });

  pi.registerCommand("confluence-status", {
    description: "Show the current Confluence connection status (site, safety level)",
    handler: async (_args, ctx) => {
      refreshStatus(ctx);
    },
  });

  pi.registerCommand("confluence-doctor", {
    description: "Check Confluence configuration, auth, and connection health",
    handler: async (_args, ctx) => {
      const result = await runDoctor({});
      ctx.ui.notify(result.content[0].text, result.isError ? "error" : "info");
    },
  });
}
