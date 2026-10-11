// Uploads a packaged extension to the Chrome Web Store (API V2) and submits it
// for review, to publish as soon as it is approved.
// Usage: node scripts/publish-chrome-web-store.mjs <extension.zip>
//
// Environment:
//   CWS_PUBLISHER_ID         Shown in the Developer Dashboard's publisher settings
//   CWS_EXTENSION_ID         The item's ID
//   CWS_SERVICE_ACCOUNT_KEY  Service account JSON key; the account's email must
//                            be added in the Developer Dashboard's Account page
//   CWS_ACCESS_TOKEN         Alternatively, an OAuth access token with the
//                            chromewebstore scope (e.g. from workload identity)
import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const API = "https://chromewebstore.googleapis.com";
const UPLOAD_TIMEOUT_MS = 5 * 60_000;

const [source] = process.argv.slice(2);
const publisherId = requireEnv("CWS_PUBLISHER_ID");
const extensionId = requireEnv("CWS_EXTENSION_ID");
if (!source) throw new Error("Usage: publish-chrome-web-store.mjs <zip>");
const item = `publishers/${publisherId}/items/${extensionId}`;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const base64url = (value) => Buffer.from(value).toString("base64url");

/** Exchanges a signed service account JWT for an access token. */
async function serviceAccountToken(keyJson) {
  const key = JSON.parse(keyJson);
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(
      JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: tokenUri,
        iat: now,
        exp: now + 600,
      }),
    ),
  ].join(".");
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key, "base64url");
  const { access_token } = await request(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  return access_token;
}

async function request(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${init.method} ${url} failed (${response.status}): ${text}`,
    );
  }
  return text ? JSON.parse(text) : {};
}

const token =
  process.env.CWS_ACCESS_TOKEN ||
  (await serviceAccountToken(requireEnv("CWS_SERVICE_ACCOUNT_KEY")));
const auth = { Authorization: `Bearer ${token}` };

console.log(`Uploading ${source} to ${extensionId}…`);
const upload = await request(`${API}/upload/v2/${item}:upload`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/zip" },
  body: await readFile(source),
});

// Large packages are processed asynchronously.
let state = upload.uploadState;
const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
while (state === "IN_PROGRESS" && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const status = await request(`${API}/v2/${item}:fetchStatus`, {
    method: "GET",
    headers: auth,
  });
  state = status.lastAsyncUploadState;
}
if (state !== "SUCCEEDED") {
  throw new Error(
    `Upload did not succeed (${state}): ${JSON.stringify(upload)}`,
  );
}
console.log(
  `Upload succeeded${upload.crxVersion ? ` (version ${upload.crxVersion})` : ""}.`,
);

const published = await request(`${API}/v2/${item}:publish`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  // Publish as soon as review approves it.
  body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
});
for (const warning of published.warningInfo?.warnings ?? []) {
  console.warn(`Warning: ${warning.reason}: ${warning.description}`);
}
console.log(`Submitted for review; item state: ${published.state}.`);
