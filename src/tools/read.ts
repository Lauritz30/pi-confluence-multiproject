import { Type, type Static } from "typebox";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { loadConfig, resolveSite } from "../config.ts";
import { createConfluenceClient } from "../client.ts";
import { siteParam, textResult } from "./shared.ts";

function getSiteClient(params: { site?: string }) {
  const config = loadConfig();
  const site = resolveSite(config, params.site);
  return { config, site, client: createConfluenceClient(site) };
}

const getPageParameters = Type.Object({
  id: Type.String({ description: "Confluence page id." }),
  bodyFormat: Type.Optional(Type.String({ description: "Body format for v2 page response, e.g. storage, atlas_doc_format." })),
  includeLabels: Type.Optional(Type.Boolean()),
  includeProperties: Type.Optional(Type.Boolean()),
  site: siteParam,
});
type GetPageParams = Static<typeof getPageParameters>;

const searchParameters = Type.Object({
  cql: Type.String({ description: "Confluence Query Language string." }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  cursor: Type.Optional(Type.String({ description: "Pagination cursor from previous search response." })),
  site: siteParam,
});
type SearchParams = Static<typeof searchParameters>;

const childrenParameters = Type.Object({
  id: Type.String({ description: "Parent page id." }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  site: siteParam,
});
type ChildrenParams = Static<typeof childrenParameters>;

const spacesParameters = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 250 })),
  keys: Type.Optional(Type.Array(Type.String({ description: "Optional space keys filter for v2 endpoint." }))),
  site: siteParam,
});
type SpacesParams = Static<typeof spacesParameters>;

const commentsParameters = Type.Object({
  id: Type.String({ description: "Page id to fetch comments for." }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  expand: Type.Optional(Type.String({ description: "V1 expand fields, e.g. body.storage,version." })),
  site: siteParam,
});
type CommentsParams = Static<typeof commentsParameters>;

export function createReadTools(): ToolDefinition<any, any, any>[] {
  return [
    {
      name: "confluence_get_page",
      label: "Get Page",
      description: "Fetch a single Confluence page by id.",
      promptSnippet: "Fetch a single Confluence page",
      parameters: getPageParameters,
      async execute(_toolCallId: string, params: GetPageParams) {
        const { client } = getSiteClient(params);
        const page = await client.get(`/pages/${encodeURIComponent(params.id)}`, {
          query: {
            "body-format": params.bodyFormat,
            includeLabels: params.includeLabels,
            includeProperties: params.includeProperties,
          },
        });

        const title = page?.title ?? "(no title)";
        return textResult(`${params.id}: ${title}`, page);
      },
    },
    {
      name: "confluence_search_content",
      label: "Search Content (CQL)",
      description: "Search Confluence content using CQL.",
      promptSnippet: "Search Confluence content with CQL",
      parameters: searchParameters,
      async execute(_toolCallId: string, params: SearchParams) {
        const { client } = getSiteClient(params);
        const result = await client.getV1("/search", {
          query: {
            cql: params.cql,
            limit: params.limit,
            cursor: params.cursor,
          },
        });

        const rows = Array.isArray(result?.results)
          ? result.results.map((item: any) => {
              const content = item.content ?? {};
              return `${content.id ?? "?"}: ${content.title ?? item.title ?? "(no title)"}`;
            })
          : [];

        return textResult(rows.join("\n") || "No content matched.", result);
      },
    },
    {
      name: "confluence_get_page_children",
      label: "Get Page Children",
      description: "List child pages for a parent page id.",
      promptSnippet: "List child pages under a Confluence page",
      parameters: childrenParameters,
      async execute(_toolCallId: string, params: ChildrenParams) {
        const { client } = getSiteClient(params);
        const result = await client.get(`/pages/${encodeURIComponent(params.id)}/children`, {
          query: { limit: params.limit },
        });

        const rows = Array.isArray(result?.results)
          ? result.results.map((child: any) => `${child.id}: ${child.title ?? "(no title)"}`)
          : [];

        return textResult(rows.join("\n") || "No child pages found.", result);
      },
    },
    {
      name: "confluence_list_spaces",
      label: "List Spaces",
      description: "List Confluence spaces.",
      promptSnippet: "List Confluence spaces",
      parameters: spacesParameters,
      async execute(_toolCallId: string, params: SpacesParams) {
        const { client } = getSiteClient(params);
        const result = await client.get("/spaces", {
          query: {
            limit: params.limit,
            keys: params.keys,
          },
        });

        const rows = Array.isArray(result?.results)
          ? result.results.map((space: any) => `${space.key ?? "?"}: ${space.name ?? "(no name)"}`)
          : [];

        return textResult(rows.join("\n") || "No spaces found.", result);
      },
    },
    {
      name: "confluence_get_page_comments",
      label: "Get Page Comments",
      description: "List comments for a Confluence page id.",
      promptSnippet: "List comments on a Confluence page",
      parameters: commentsParameters,
      async execute(_toolCallId: string, params: CommentsParams) {
        const { client } = getSiteClient(params);
        const result = await client.getV1(`/content/${encodeURIComponent(params.id)}/child/comment`, {
          query: {
            limit: params.limit,
            expand: params.expand,
          },
        });

        const rows = Array.isArray(result?.results)
          ? result.results.map((comment: any) => {
              const body = comment.body?.storage?.value;
              const compact = typeof body === "string" ? body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
              return `${comment.id}: ${compact.slice(0, 120)}`;
            })
          : [];

        return textResult(rows.join("\n") || "No comments found.", result);
      },
    },
  ];
}
