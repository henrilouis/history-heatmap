# Visit-level history performance

## Method

`npm run benchmark:history` builds the actual history utilities into a temporary
Manifest V3 extension with the `history` permission. It launches an isolated,
headless Chrome instance, lets Chrome initialize its database, shuts it down,
and seeds **100,000 distinct URLs with five visits each (500,000 visits)** into
that disposable database. Timestamps fall within the preceding 89 days. URLs
span 1,000 synthetic hosts and have page titles.

After restarting Chrome, the extension calls the production `getHistory()` via
real `chrome.history.search()` and `chrome.history.getVisits()` APIs. These are
real browser IPC calls, not timer-based mocks. Each run verifies the exact URL
and visit counts. Three loads run in the same browser, releasing the preceding
result and requesting garbage collection between runs.

The benchmark reports:

- Load time, including URL search, visit retrieval, projection, and global sort.
- Time to build both grouped views and fill their date ranges.
- Mean filter time over ten searches for `site-12.example` per run.
- Retained JavaScript heap increase for the loaded visits after garbage
  collection, measured through the Chrome DevTools Protocol.

It does **not** measure DOM rendering, Svelte updates, native browser/database
memory, or cold disk access. The database is synthetic rather than a personal
browsing profile. Results vary with hardware, profile shape, caches, JIT, and GC.

## Measurements

Recorded on an Apple M3 Pro, macOS arm64, Chrome 152.0.7977.83, Node 24.18.0.
Concurrency is eight in both versions. Baseline is commit `3923a79`; the updated
version includes the review changes in this PR.

| Measurement                  | Baseline, median (range)    | Updated, median (range)     |
| ---------------------------- | --------------------------- | --------------------------- |
| Load 100k URLs / 500k visits | 3.92 s (3.82–4.30 s)        | 3.77 s (3.68–4.46 s)        |
| Group and fill both views    | 2.29 s (2.20–2.69 s)        | 1.54 s (1.31–1.57 s)        |
| Filter, mean per run         | 468 ms (118–507 ms)         | 266 ms (265–272 ms)         |
| Retained visit heap          | 77.86 MiB (77.86–77.88 MiB) | 45.63 MiB (45.62–45.65 MiB) |

Projection to four fields reduces retained visit heap by approximately **41%**.
URL and title strings were already shared references in the baseline; the saving
comes from omitting unused visit metadata and the smaller object layout. Filtering
now computes each URL's text match once per query; it still scans all visits to
preserve chronology. The filter measurements show substantial run-to-run variation
and should not be read as a guaranteed speedup for every search.

## Temporal migration (#2)

Measured on the same Apple M3 Pro and Chrome 152.0.7977.83, using Node 26.8.2
for both versions, with three loads of 100,000 URLs / 500,000 visits per version:

| Measurement               | Date baseline, median (range) | Temporal, median (range)    |
| ------------------------- | ----------------------------- | --------------------------- |
| Load                      | 3.96 s (3.71–4.09 s)          | 4.01 s (3.55–4.17 s)        |
| Group and fill both views | 1.06 s (1.04–1.51 s)          | 0.71 s (0.69–1.19 s)        |
| Filter, mean per run      | 238 ms (231–242 ms)           | 234 ms (232–267 ms)         |
| Retained visit heap       | 45.63 MiB (45.62–45.65 MiB)   | 45.63 MiB (45.62–45.65 MiB) |

An initial direct Temporal conversion per visit took 8.21 s median for grouping.
The final implementation keeps one local-hour key interval per grouping operation
and reuses it for visits inside that interval. Temporal supplies the local date,
hour, and timezone-transition bounds. Clipping the interval at offset changes
handles repeated hours and transitions that split an hour; unsorted input
recomputes keys whenever it leaves the interval. This takes advantage of the
normally newest-first history without retaining a per-visit cache.

The measured grouping median is approximately 33% lower than the Date baseline.
These results describe the synthetic, sorted workload, not a guaranteed speedup
for every input order or browser version. Loading/filtering are unchanged and
their timing variation should not be attributed to Temporal.

## Loading decisions

The full-history search is retained so earlier recorded activity remains available.
Exact all-history counts still require one `getVisits()` call per URL; the Chrome
extension API has no bulk visit endpoint. At this measured scale the load takes
seconds rather than minutes, so concurrency remains at eight instead of increasing
IPC pressure or silently truncating history.

Long loads now show progress (throttled to roughly ten updates per second) and
offer Cancel. Cancellation stops queued requests and retries; Chrome calls already
issued cannot be cancelled. New loads abort old work and use a request ID to guard
data, errors, progress, and loading-state assignments. Each URL gets one retry for
a transient failure. Persistent failure rejects the load rather than reporting
incomplete counts as complete history.

The store uses immutable, non-proxied visit arrays to avoid deep reactive proxies
per visit. Grouping and filtering still scale with visit count; these measurements
do not establish end-to-end rendering performance for every large profile.

## Reproduction

```sh
CHROME_PATH="/path/to/chrome" npm run benchmark:history
```

On macOS, the default executable is
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
Use the Node 26 version in `.nvmrc` and Chrome 144 or newer with support for CDP
`Extensions.loadUnpacked`.
The script uses a dedicated debugging pipe and a newly created profile for every
invocation. It never opens the default browser profile. Artifacts remain in the
printed temporary directory for inspection.

Optional environment variables: `BENCHMARK_URLS` (default 100000),
`BENCHMARK_VISITS_PER_URL` (default 5), `BENCHMARK_RUNS` (default 3), and `TMPDIR`
for the temporary directory parent.
