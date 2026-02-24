import keytar from "keytar";
import open from "open";
import readline from "readline";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname } from "path";

const SERVICE_NAME = "mail-cli";
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const TOKENS_FILE = `${homedir()}/.mail-cli/tokens.json`;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.labels",
  "openid",
  "email",
];

function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GMAIL_CLIENT_ID!,
      client_secret: GMAIL_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }
  return response.json();
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GMAIL_CLIENT_ID!,
      client_secret: GMAIL_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }
  return response.json();
}

async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Failed to get user info: ${await response.text()}`);
  }
  const data = (await response.json()) as { email: string };
  return data.email;
}

export async function authenticate(): Promise<{ email: string }> {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error("Error: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set");
    console.error("Get credentials from https://console.cloud.google.com/apis/credentials");
    process.exit(1);
  }

  const authUrl = getAuthUrl(REDIRECT_URI);
  console.log("\nOpen this URL on your browser (Mac is fine):\n");
  console.log(authUrl);
  console.log(
    "\nAfter Google redirects, copy the full redirected URL from the browser and paste it here."
  );

  open(authUrl).catch(() => {});

  const pasted = await new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("\nPaste redirected URL (or code): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const code = extractCodeFromInput(pasted);
  if (!code) {
    throw new Error("Could not find authorization code in your input");
  }

  const tokens = await exchangeCodeForTokens(code, REDIRECT_URI);
  const email = await getUserEmail(tokens.access_token);

  await setToken(email, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  console.log(`\nAuthenticated as ${email}\n`);
  return { email };
}

function extractCodeFromInput(input: string): string | null {
  if (!input) return null;
  if (input.startsWith("http://") || input.startsWith("https://")) {
    try {
      const url = new URL(input);
      return url.searchParams.get("code");
    } catch {
      return null;
    }
  }
  return input;
}

export async function getStoredToken(email: string): Promise<string | null> {
  const stored = await getToken(email);
  if (!stored) return null;

  const tokens = JSON.parse(stored) as {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };

  if (Date.now() >= tokens.expiresAt - 60000) {
    const newTokens = await refreshAccessToken(tokens.refreshToken);
    await setToken(email, {
      accessToken: newTokens.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + newTokens.expires_in * 1000,
    });
    return newTokens.access_token;
  }

  return tokens.accessToken;
}

export async function removeToken(email: string): Promise<void> {
  await deleteToken(email);
}

type StoredToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

function ensureTokenFileDir() {
  const dir = dirname(TOKENS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readTokenMap(): Record<string, string> {
  if (!existsSync(TOKENS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(TOKENS_FILE, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeTokenMap(data: Record<string, string>) {
  ensureTokenFileDir();
  writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function setToken(email: string, token: StoredToken): Promise<void> {
  const payload = JSON.stringify(token);
  try {
    await keytar.setPassword(SERVICE_NAME, email, payload);
  } catch {
    const map = readTokenMap();
    map[email] = payload;
    writeTokenMap(map);
  }
}

async function getToken(email: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, email);
  } catch {
    const map = readTokenMap();
    return map[email] ?? null;
  }
}

async function deleteToken(email: string): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE_NAME, email);
  } catch {
    const map = readTokenMap();
    delete map[email];
    writeTokenMap(map);
  }
}
