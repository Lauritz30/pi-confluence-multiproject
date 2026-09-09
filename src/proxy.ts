import { ProxyAgent } from "undici";

let cachedDispatcher: unknown | undefined;

/** Build and cache an undici ProxyAgent from HTTPS_PROXY/HTTP_PROXY when present. */
export function getProxyDispatcher(): unknown {
  if (cachedDispatcher !== undefined) return cachedDispatcher;

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxyUrl) {
    cachedDispatcher = null;
    return undefined;
  }

  cachedDispatcher = new ProxyAgent(proxyUrl);
  return cachedDispatcher;
}
