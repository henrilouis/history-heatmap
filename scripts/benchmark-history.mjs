// Real Chrome IPC against a disposable, synthetic history database.
// Usage: CHROME_PATH=/path/to/chrome node scripts/benchmark-history.mjs
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir, cpus, platform, arch } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { build } from "vite";

const executable = process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const urlCount = Number(process.env.BENCHMARK_URLS ?? 100_000);
const visitsPerUrl = Number(process.env.BENCHMARK_VISITS_PER_URL ?? 5);
const runs = Number(process.env.BENCHMARK_RUNS ?? 3);
for (const value of [urlCount, visitsPerUrl, runs]) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Benchmark sizes and run count must be positive integers");
  }
}
const directory = await mkdtemp(join(tmpdir(), "history-heatmap-benchmark-"));
const extension = join(directory, "extension");
const profile = join(directory, "profile");
await mkdir(extension);

await build({
  configFile: false,
  publicDir: false,
  logLevel: "error",
  build: {
    outDir: extension,
    minify: false,
    lib: {
      entry: resolve("src/lib/utils/chrome-api.ts"),
      formats: ["es"],
      fileName: () => "history.js",
    },
  },
});
await writeFile(join(extension, "manifest.json"), JSON.stringify({
  manifest_version: 3,
  name: "Synthetic history benchmark",
  version: "1.0",
  permissions: ["history"],
  background: { service_worker: "worker.js", type: "module" },
}));
await writeFile(join(extension, "worker.js"),
  'import * as api from "./history.js"; globalThis.api = api;');

function launch() {
  const child = spawn(executable, [
    "--headless=new",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-sync",
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  const exited = once(child, "exit");
  const pending = new Map();
  let id = 0;
  let buffer = "";
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdio[4].on("data", (chunk) => {
    buffer += chunk.toString();
    let separator;
    while ((separator = buffer.indexOf("\0")) !== -1) {
      const message = JSON.parse(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 1);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  child.on("exit", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Chrome exited: ${stderr}`));
    }
    pending.clear();
  });
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timed out: ${method}`));
      }, 600_000);
      pending.set(requestId, { resolve, reject, timeout });
      child.stdio[3].write(JSON.stringify({ id: requestId, method, params, sessionId }) + "\0");
    });
  }
  async function attach() {
    await send("Extensions.loadUnpacked", { path: extension });
    for (let attempt = 0; attempt < 100; attempt++) {
      const { targetInfos } = await send("Target.getTargets");
      const worker = targetInfos.find((target) => target.url.endsWith("/worker.js"));
      if (worker) {
        const { sessionId } = await send("Target.attachToTarget", {
          targetId: worker.targetId, flatten: true,
        });
        await send("Runtime.enable", {}, sessionId);
        await send("Runtime.runIfWaitingForDebugger", {}, sessionId);
        for (let ready = 0; ready < 100; ready++) {
          if (await evaluate(sessionId,
            'typeof chrome !== "undefined" && !!chrome.history && !!globalThis.api')) {
            return sessionId;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error("Benchmark extension APIs did not initialize");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Benchmark extension did not start");
  }
  async function evaluate(session, expression) {
    const result = await send("Runtime.evaluate", {
      expression, awaitPromise: true, returnByValue: true,
    }, session);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function close() {
    if (child.exitCode !== null) return;
    await send("Browser.close");
    await exited;
  }
  return { send, attach, evaluate, close };
}

// Let Chrome create its own schema before seeding it while the browser is closed.
let browser = launch();
try {
  const session = await browser.attach();
  await browser.evaluate(session,
    'chrome.history.addUrl({url: "https://benchmark.invalid/bootstrap"})');
} finally {
  await browser.close();
}

const db = new DatabaseSync(join(profile, "Default", "History"));
db.exec("DELETE FROM visits; DELETE FROM urls; BEGIN TRANSACTION;");
const insertUrl = db.prepare(
  "INSERT INTO urls (id, url, title, visit_count, typed_count, last_visit_time, hidden) VALUES (?, ?, ?, ?, 0, ?, 0)",
);
const insertVisit = db.prepare(
  "INSERT INTO visits (id, url, visit_time, from_visit, transition, segment_id, visit_duration) VALUES (?, ?, ?, 0, 805306368, 0, 0)",
);
const now = Date.now() - 60_000;
const day = 86_400_000;
let visitId = 0;
for (let urlId = 1; urlId <= urlCount; urlId++) {
  const times = Array.from({ length: visitsPerUrl }, (_, visit) =>
    now - ((urlId * 7919 + visit * 17 * day) % (89 * day)),
  );
  const chromeTime = (timestamp) => BigInt(timestamp + 11_644_473_600_000) * 1000n;
  insertUrl.run(urlId, `https://site-${urlId % 1000}.example/page/${urlId}`,
    `Example page ${urlId} — synthetic browsing history`, visitsPerUrl,
    chromeTime(Math.max(...times)));
  for (const time of times) insertVisit.run(++visitId, urlId, chromeTime(time));
}
db.exec("COMMIT;");
db.close();

browser = launch();
try {
  const version = await browser.send("Browser.getVersion");
  const session = await browser.attach();
  console.log(JSON.stringify({
    browser: version.product, node: process.version,
    cpu: cpus()[0].model, platform: platform(), arch: arch(),
    urlCount, visitsPerUrl, directory,
  }));
  for (let run = 1; run <= runs; run++) {
    await browser.evaluate(session, "globalThis.visits = undefined");
    await browser.send("HeapProfiler.collectGarbage", {}, session);
    const before = await browser.send("Runtime.getHeapUsage", {}, session);
    const load = await browser.evaluate(session, `(async () => {
      const start = performance.now();
      globalThis.visits = await api.getHistory();
      return { loadMs: performance.now() - start, visits: visits.length,
        urls: new Set(visits.map(visit => visit.url)).size };
    })()`);
    if (load.visits !== urlCount * visitsPerUrl || load.urls !== urlCount) {
      throw new Error(`Unexpected history count: ${JSON.stringify(load)}`);
    }
    await browser.send("HeapProfiler.collectGarbage", {}, session);
    const after = await browser.send("Runtime.getHeapUsage", {}, session);
    const processing = await browser.evaluate(session, `(() => {
      const start = performance.now();
      api.fillEmptyDays(api.groupHistoryByDay(visits), visits);
      api.fillEmptyHours(api.groupHistoryByDayAndHour(visits), visits);
      const groupMs = performance.now() - start;
      const filterStart = performance.now();
      for (let i = 0; i < 10; i++) {
        if (api.filterHistory) api.filterHistory(visits, "site-12.example");
        else visits.filter(visit => visit.title?.toLowerCase().includes("site-12.example") ||
          visit.url?.toLowerCase().includes("site-12.example"));
      }
      return { groupMs, filterMs: (performance.now() - filterStart) / 10 };
    })()`);
    console.log(JSON.stringify({ run, ...load, ...processing,
      retainedHeapMiB: (after.usedSize - before.usedSize) / 1024 / 1024,
    }));
  }
} finally {
  await browser.close();
}
