/**
 * OAuth2 client credentials token management for Greenhouse Harvest v3 API.
 */

const TOKEN_URL = "https://auth.greenhouse.io/token";

interface TokenResponse {
  token_type: string;
  access_token: string;
  expires_at: string;
}

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to obtain access token: ${res.status} ${res.statusText} - ${body}`
    );
  }

  const data = (await res.json()) as TokenResponse;
  cachedToken = data.access_token;
  tokenExpiresAt = new Date(data.expires_at).getTime();

  return cachedToken;
}
