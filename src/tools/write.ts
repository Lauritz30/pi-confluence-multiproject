import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { toStorageBody } from "../body.ts";
import { createConfluenceClient } from "../client.ts";
import { loadConfig, resolveSite } from "../config.ts";
import { guardMutation, type MutationContext } from "../safety.ts";
import { siteParam, textResult } from "./shared.ts";

function getSiteClient(params: { site?: string }) {
  const config = loadConfig();
  const site = resolveSite(config, params.site);
  return { config, site, client: createConfluenceClient(site) };
}

const createPageParameters = Type.Object({
  spaceKey: Type.String({ description: "Space key, e.g. ENG." }),
  title: Type.String(),
  body: Type.String({ description: "Plain text body; auto-converted to Confluence storage format." }),
  parentId: Type.Optional(Type.String({ description: "Parent page id for nesting." })),
  site: siteParam,
});
type CreatePageParams = Static<typeof createPageParameters>;

const updatePageParameters = Type.Object({
  id: Type.String({ description: "Page id." }),
  title: Type.String(),
  body: Type.String({ description: "Plain text body; auto-converted to Confluence storage format." }),
  version: Type.Optional(Type.Integer({ minimum: 1, description: "Current page version. If omitted, fetched automatically." })),
  site: siteParam,
});
type UpdatePageParams = Static<typeof updatePageParameters>;

const commentParameters = Type.Object({
  pageId: Type.String({ description: "Page id to comment on." }),
  body: Type.String({ description: "Plain text comment; auto-converted to Confluence storage format." }),
  site: siteParam,
});
type CommentParams = Static<typeof commentParameters>;

const labelParameters = Type.Object({
  pageId: Type.String({ description: "Page id to label." }),
  label: Type.String({ description: "Label to add." }),
  site: siteParam,
});
type LabelParams = Static<typeof labelParameters>;

export function createWriteTools(): ToolDefinition<any, any, any>[] {
  return [
    {
      name: "confluence_create_page",
      label: "Create Page",
      description: "Create a Confluence page. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Create a Confluence page",
      parameters: createPageParameters,
      async execute(
        _toolCallId: string,
        params: CreatePageParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Create Confluence page",
          message: `Create page \"${params.title}\" in ${params.spaceKey}?`,
          action: "confluence_create_page",
          spaceKey: params.spaceKey,
        });

        const created = await client.postV1("/content", {
          type: "page",
          title: params.title,
          space: { key: params.spaceKey },
          ...(params.parentId ? { ancestors: [{ id: params.parentId }] } : {}),
          body: {
            storage: toStorageBody(params.body),
          },
        });

        return textResult(`Created page ${created.id}: ${site.url}/wiki${created._links?.webui ?? ""}`, created);
      },
    },
    {
      name: "confluence_update_page",
      label: "Update Page",
      description: "Update a Confluence page with automatic version increment. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Update a Confluence page",
      parameters: updatePageParameters,
      async execute(
        _toolCallId: string,
        params: UpdatePageParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Update Confluence page",
          message: `Update page ${params.id} (\"${params.title}\")?`,
          action: "confluence_update_page",
          pageIds: [params.id],
        });

        let currentVersion = params.version;
        if (!currentVersion) {
          const page = await client.getV1(`/content/${encodeURIComponent(params.id)}`, {
            query: { expand: "version" },
          });
          currentVersion = page?.version?.number;
          if (!Number.isInteger(currentVersion)) {
            throw new Error("Unable to resolve current page version. Provide the 'version' parameter explicitly.");
          }
        }

        const updated = await client.putV1(`/content/${encodeURIComponent(params.id)}`, {
          id: params.id,
          type: "page",
          title: params.title,
          version: { number: Number(currentVersion) + 1 },
          body: {
            storage: toStorageBody(params.body),
          },
        });

        return textResult(`Updated page ${params.id}.`, { id: params.id, site: site.name, version: Number(currentVersion) + 1, updated });
      },
    },
    {
      name: "confluence_add_comment",
      label: "Add Comment",
      description: "Add a comment to a Confluence page. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Add a comment to a Confluence page",
      parameters: commentParameters,
      async execute(
        _toolCallId: string,
        params: CommentParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Add Confluence comment",
          message: `Add comment to page ${params.pageId}?`,
          action: "confluence_add_comment",
          pageIds: [params.pageId],
        });

        const comment = await client.postV1(`/content/${encodeURIComponent(params.pageId)}/child/comment`, {
          type: "comment",
          body: {
            storage: toStorageBody(params.body),
          },
        });

        return textResult(`Added comment ${comment.id} to page ${params.pageId}.`, comment);
      },
    },
    {
      name: "confluence_add_label",
      label: "Add Label",
      description: "Add a label to a Confluence page. Gated by safetyLevel (default: confirm).",
      promptSnippet: "Add a label to a Confluence page",
      parameters: labelParameters,
      async execute(
        _toolCallId: string,
        params: LabelParams,
        _signal: AbortSignal | undefined,
        _onUpdate: unknown,
        ctx: MutationContext | undefined,
      ) {
        const { config, site, client } = getSiteClient(params);
        await guardMutation(config, site, ctx, {
          title: "Add Confluence label",
          message: `Add label \"${params.label}\" to page ${params.pageId}?`,
          action: "confluence_add_label",
          pageIds: [params.pageId],
        });

        const result = await client.postV1(`/content/${encodeURIComponent(params.pageId)}/label`, [
          { prefix: "global", name: params.label },
        ]);

        return textResult(`Added label ${params.label} to page ${params.pageId}.`, { site: site.name, result });
      },
    },
  ];
}
