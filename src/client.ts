import { buildBasicAuthHeader } from "./auth.ts";
import { getProxyDispatcher } from "./proxy.ts";
import type { ConfluenceSiteConfig } from "./config.ts";

export class ConfluenceApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, { status, body }: { status?: number; body?: unknown } = {}) {
    super(message);
    this.name = "ConfluenceApiError";
    this.status = status;
    this.body = body;
  }
}

const RETRYABLE_STATUS = 429;
const MAX_RETRIES = 2;

type Query = Record<string, unknown>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

interface FetchLike {
  (url: string, init: Record<string, unknown>): Promise<ResponseLike>;
}

interface ResponseLike {
  status: number;
  ok: boolean;
  statusText: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

function buildQueryString(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function stripTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === "/") end -= 1;
  return url.slice(0, end);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function extractErrorDetail(body: unknown): string | undefined {
  const record = body as { message?: string; data?: { authorized?: boolean; valid?: boolean }; errors?: unknown } | null;
  if (typeof record?.message === "string" && record.message) return record.message;
  if (record?.errors) return JSON.stringify(record.errors);
  return undefined;
}

function messageForStatus(status: number, statusText: string, body: unknown): string {
  const detail = extractErrorDetail(body);
  const suffix = detail ? ` ${detail}` : "";

  switch (status) {
    case 401:
      return `Confluence authentication failed (401). Check the site email/apiToken in the config file.${suffix}`;
    case 403:
      return `Confluence denied the request (403 Forbidden). The account may lack permission for this operation.${suffix}`;
    case 404:
      return `Confluence resource not found (404).${suffix}`;
    default:
      return `Confluence API request failed: ${status} ${statusText}${suffix}`;
  }
}

async function parseResponseBody(response: ResponseLike): Promise<unknown> {
  const text = await response.text();
  return text ? safeJsonParse(text) : undefined;
}

function resolveRetryAfterSeconds(response: ResponseLike): number {
  const parsed = Number(response.headers.get("retry-after"));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

interface ClientOptions {
  fetchImpl?: FetchLike;
  dispatcher?: unknown;
}

export interface ConfluenceClient {
  get(path: string, options?: RequestOptions): Promise<any>;
  post(path: string, body?: unknown, options?: RequestOptions): Promise<any>;
  put(path: string, body?: unknown, options?: RequestOptions): Promise<any>;
  getV1(path: string, options?: RequestOptions): Promise<any>;
  postV1(path: string, body?: unknown, options?: RequestOptions): Promise<any>;
  putV1(path: string, body?: unknown, options?: RequestOptions): Promise<any>;
}

export function createConfluenceClient(
  site: ConfluenceSiteConfig,
  { fetchImpl = fetch as unknown as FetchLike, dispatcher = getProxyDispatcher() }: ClientOptions = {},
): ConfluenceClient {
  const rootUrl = stripTrailingSlashes(site.url);
  const v2BaseUrl = `${rootUrl}/wiki/api/v2`;
  const v1BaseUrl = `${rootUrl}/wiki/rest/api`;
  const authHeader = buildBasicAuthHeader(site.email, site.apiToken ?? "");

  async function requestOnce(url: string, method: string, body: unknown, signal?: AbortSignal): Promise<ResponseLike> {
    return fetchImpl(url, {
      method,
      signal,
      ...(dispatcher ? { dispatcher } : {}),
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  async function request(baseUrl: string, method: string, path: string, { query, body, signal }: RequestOptions = {}): Promise<any> {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${baseUrl}${normalizedPath}${buildQueryString(query)}`;

    for (let attempt = 0; ; attempt++) {
      const response = await requestOnce(url, method, body, signal);

      if (response.status === RETRYABLE_STATUS && attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, resolveRetryAfterSeconds(response) * 1000));
        continue;
      }

      if (response.status === 204) return undefined;

      const json = await parseResponseBody(response);
      if (!response.ok) {
        throw new ConfluenceApiError(messageForStatus(response.status, response.statusText, json), {
          status: response.status,
          body: json,
        });
      }

      return json;
    }
  }

  return {
    get: (path: string, options?: RequestOptions) => request(v2BaseUrl, "GET", path, options),
    post: (path: string, body?: unknown, options?: RequestOptions) => request(v2BaseUrl, "POST", path, { ...options, body }),
    put: (path: string, body?: unknown, options?: RequestOptions) => request(v2BaseUrl, "PUT", path, { ...options, body }),
    getV1: (path: string, options?: RequestOptions) => request(v1BaseUrl, "GET", path, options),
    postV1: (path: string, body?: unknown, options?: RequestOptions) => request(v1BaseUrl, "POST", path, { ...options, body }),
    putV1: (path: string, body?: unknown, options?: RequestOptions) => request(v1BaseUrl, "PUT", path, { ...options, body }),
  };
}
