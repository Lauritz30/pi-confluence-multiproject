import { Type } from "typebox";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
  isError?: boolean;
}

export function textResult(text: string, details: unknown = {}): ToolResult {
  return { content: [{ type: "text", text }], details };
}

export function errorResult(message: string): ToolResult {
  return { content: [{ type: "text", text: `❌ ${message}` }], details: { error: true }, isError: true };
}

export const siteParam = Type.Optional(Type.String({ description: "Site name to use; defaults to defaultSite." }));
