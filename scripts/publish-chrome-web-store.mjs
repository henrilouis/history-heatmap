// Uploads a packaged extension to the Chrome Web Store (API V2) and submits it
// for review, to publish as soon as it is approved. Does nothing when the store
// already has the version in review or published, so an interrupted release
// can be re-run to finish its remaining steps.
// Usage: node scripts/publish-chrome-web-store.mjs <extension.zip> <version>
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

// Revision states in which a version needs no new upload or submission.
// REJECTED and CANCELLED revisions may be submitted again.
const SUBMITTED_STATES = new Set([
  "PENDING_REVIEW",
  "STAGED",
  "PUBLISHED",
  "PUBLISHED_TO_TESTERS",
]);

const [source, version] = process.argv.slice(2);
const publisherId = requireEnv("CWS_PUBLISHER_ID");
const extensionId = requireEnv("CWS_EXTENSION_ID");
if (!source || !version) {
  throw new Error("Usage: publish-chrome-web-store.mjs <zip> <version>");
}
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

const fetchStatus = () =>
  request(`${API}/v2/${item}:fetchStatus`, { method: "GET", headers: auth });

/** The published or in-review revision carrying `version`, if any. */
function submittedRevision(status) {
  return [
    status.submittedItemRevisionStatus,
    status.publishedItemRevisionStatus,
  ].find(
    (revision) =>
      SUBMITTED_STATES.has(revision?.state) &&
      revision.distributionChannels?.some(
        (channel) => channel.crxVersion === version,
      ),
  );
}

async function upload() {
  console.log(`Uploading ${source} (version ${version}) to ${extensionId}…`);
  const uploaded = await request(`${API}/upload/v2/${item}:upload`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/zip" },
    body: await readFile(source),
  });

  // Large packages are processed asynchronously.
  let state = uploaded.uploadState;
  const deadline = Date.now() + UPLOAD_TIMEOUT_MS;
  while (state === "IN_PROGRESS" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    state = (await fetchStatus()).lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED") {
    throw new Error(
      `Upload did not succeed (${state}): ${JSON.stringify(uploaded)}`,
    );
  }
  console.log("Upload succeeded.");
}

async function submit() {
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
}

// A previous run may have submitted this version before failing, or the
// publish response may have been lost. Uploading again would be rejected.
const existing = submittedRevision(await fetchStatus());
if (existing) {
  console.log(`Version ${version} is already ${existing.state}; skipping.`);
} else {
  await upload();
  await submit();
}
