/**
 * HTTP client for Greenhouse Harvest v3 API with pagination support.
 */

import { getAccessToken } from "./auth.js";

const BASE_URL = "https://harvest.greenhouse.io/v3";

interface ClientConfig {
  clientId: string;
  clientSecret: string;
}

let config: ClientConfig | null = null;

export function configure(clientId: string, clientSecret: string): void {
  config = { clientId, clientSecret };
}

function getConfig(): ClientConfig {
  if (!config) {
    throw new Error(
      "Greenhouse client not configured. Set GREENHOUSE_CLIENT_ID and GREENHOUSE_CLIENT_SECRET."
    );
  }
  return config;
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function parseLinkHeader(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

export interface ApiResponse<T> {
  data: T;
  nextCursor: string | null;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<ApiResponse<T>> {
  const { clientId, clientSecret } = getConfig();
  const token = await getAccessToken(clientId, clientSecret);
  const url = buildUrl(path, params);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Greenhouse API error: ${res.status} ${res.statusText} - ${body}`);
  }

  const data = (await res.json()) as T;
  const linkHeader = res.headers.get("link");
  const nextUrl = parseLinkHeader(linkHeader);

  // Extract cursor from next URL if present
  let nextCursor: string | null = null;
  if (nextUrl) {
    const parsed = new URL(nextUrl);
    nextCursor = parsed.searchParams.get("cursor");
  }

  return { data, nextCursor };
}

/**
 * POST request to the Greenhouse API (for write operations).
 */
export async function apiPost<T>(
  path: string,
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const { clientId, clientSecret } = getConfig();
  const token = await getAccessToken(clientId, clientSecret);
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Greenhouse API error: ${res.status} ${res.statusText} - ${text}`);
  }

  // Some POST endpoints return 204 No Content
  if (res.status === 204) {
    return { data: {} as T, nextCursor: null };
  }

  const data = (await res.json()) as T;
  return { data, nextCursor: null };
}

/**
 * Fetch a single page using a cursor URL directly (for pagination).
 * When using cursor pagination, cursor must be the ONLY query param.
 */
export async function apiGetWithCursor<T>(
  path: string,
  cursor: string,
  perPage?: number
): Promise<ApiResponse<T>> {
  const { clientId, clientSecret } = getConfig();
  const token = await getAccessToken(clientId, clientSecret);

  // Per the API docs, when using cursor, it must be the only query param
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Greenhouse API error: ${res.status} ${res.statusText} - ${body}`);
  }

  const data = (await res.json()) as T;
  const linkHeader = res.headers.get("link");
  const nextUrl = parseLinkHeader(linkHeader);

  let nextCursor: string | null = null;
  if (nextUrl) {
    const parsed = new URL(nextUrl);
    nextCursor = parsed.searchParams.get("cursor");
  }

  return { data, nextCursor };
}
