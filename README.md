# History heatmap

This is a chromium plugin that adds an interactive calendar heatmap to the browser history to allow for getting a better understanding of one's browsing behavior.

Find the plugin [in the chrome web store](https://chromewebstore.google.com/detail/history-heatmap/laddklgjajohacmmgojapiealpgfbfod).

## History data

The heatmap counts individual visits at their recorded local date and hour.
`chrome.history.search()` supplies URLs and their latest titles; the extension
retrieves each URL's visit records with `chrome.history.getVisits()`, with at most
eight requests in flight. Repeated visits remain visible in their original cells.
Loading shows URL progress and can be cancelled. A failed visit request is retried
once for that URL; if it still fails, the load shows an error and Retry rather than
partial counts. Starting a new load cancels the previous one, and stale results
cannot replace the newer load. The history list displays each visit separately; **Delete all visits**
removes every visit to that URL, including visits on other days.

Open pages stay synchronized with Chrome history events. External URL removals
immediately disappear from the store, search results, and calendar views; clearing
all history also clears the selection. Results from outstanding requests cannot
restore deleted records. Newly visited URLs are refreshed in bounded batches using
`getVisits()`, preserving earlier visits without reloading the entire history.
Events arriving during the initial load are reconciled afterward. Listeners are
shared while the page is mounted and removed on teardown.
Background refresh failures show a separate, non-blocking notice while preserving
loaded history. The notice clears when affected URLs recover or are removed, or
when a full refresh starts. After a full load fails or is cancelled, incremental
updates wait for a successful Retry so they cannot create a partial heatmap.

## Development

Use Node.js 24 (also used in CI) and install dependencies with `npm ci`.
`@types/node` intentionally follows major 24 to match that runtime. The toolchain
uses Vitest 5, Oxlint, Oxfmt, and the TypeScript 7 native preview (`tsgo`). The
native preview is exact-pinned so installs use the same compiler version.
TypeScript 6 is also installed for `svelte-check`, whose peer dependency range
currently supports TypeScript 5 and 6 and whose Svelte diagnostics require the
JavaScript compiler API.

### Linting, formatting, and type checking

```sh
npm run lint          # Oxlint correctness rules; warnings fail the check
npm run lint:fix      # Apply automatic lint fixes
npm run format        # Format the project with Oxfmt
npm run format:check  # Check formatting without writing files
npm run check         # Run tsgo and Svelte diagnostics
```

Oxlint is configured in `.oxlintrc.json` and checks JavaScript, TypeScript, and
Svelte script blocks. Oxfmt is configured in `.oxfmtrc.json`, including Svelte
formatting, with two-space indentation, double quotes, semicolons, and an
80-column print width. Generated output, Fallow's cache, and the npm lockfile
are excluded from formatting. Install the recommended Oxc VS Code extension
for editor integration.

`npm run check:types` runs `tsgo` against both the app and Vite configuration.
`npm run check:svelte` runs `svelte-check` for component-aware diagnostics;
`tsgo` does not replace Svelte template checking. CI runs type checks, lint,
format verification, and the full Fallow audit in its static-check job.

### Pre-commit checks

`npm ci` (or `npm install`) installs the Git pre-commit hook through
`simple-git-hooks`. The hook runs the project-local [Fallow](https://fallow.tools/)
to check for dead code, complexity, duplication, and styling issues using
`.fallowrc.json`. Newly introduced findings compared with `HEAD` block the commit;
inherited findings do not.

The local hook deliberately analyzes the working tree rather than taking a
snapshot of the Git index or stashing edits. With partial staging or
`git commit <path>`, unrelated unstaged code can block the commit, and unstaged
fixes can hide issues still present in the staged version. Set aside unrelated
edits before committing when you need the audit to match the commit. CI runs
the full-project check on the checked-out commit independently of the local hook.

Run the incremental audit manually (`fallow audit --base HEAD`, including
unstaged changes):

```sh
npm run fallow
```

Run a full-project scan, including inherited findings:

```sh
npm run fallow:all
```

This runs `fallow --fail-on-issues`, making the full scan a blocking check in the
CI static-check job on every pull request and push to `main`.

The configuration lists `svelte.config.js` as an entry point because the Svelte
Vite plugin and `svelte-check` load it implicitly. Svelte stays in
`devDependencies`: the extension ships Vite's compiled/bundled output and never
resolves packages from `node_modules` at runtime. The `svelte` dependency exception
in Fallow reflects that packaging model. Duplication checks require three
occurrences to focus on repeated copy-paste; lower `duplicates.minOccurrences`
to 2 to include duplicate pairs.

Fallow is exact-pinned for reproducible local and CI checks. Dependabot checks
weekly for Fallow updates and opens PRs to update the pin and lockfile; review
new findings before merging those upgrades.

Run `npm run prepare` to reinstall the hook after changing its configuration.

### Unit tests

Run the Vitest suite once (exits with a nonzero status on failure):

```sh
npm test
```

Run tests in watch mode while developing:

```sh
npm run test:watch
```

Tests live alongside source files as `*.test.ts`. The default Vitest project runs
in Node; `*-client.test.ts` files run in a jsdom project with browser resolution.
Chrome APIs
are mocked, so tests do not require an extension installation or access real
browsing history. The suite covers history search and deletion callbacks, API
failures and retries, unavailable Chrome history APIs, and day/hour grouping,
including sorting, missing timestamps, local-midnight boundaries, DST transitions,
and input preservation. Regression tests also cover local date parsing, rendered
calendar rows and headers, fallback selection labels, inclusive filtered date
ranges, leap days, and range computation with 150,000 history records.
Visit-level regressions cover repeated visits across days and hours, revisiting a
URL, bounded request concurrency, out-of-order responses, and retrieval failures.
List-rendering tests check individual timestamps, and store-action tests verify
URL-wide deletion, failed-deletion preservation, and load retries.
Tests also cover progress, cancellation, stale fetches, compact visit records,
and case-insensitive matching of all visits sharing URL metadata.
Live-history tests cover external removals, clear-all, new visits, event/load races,
mixed-URL batches where one URL is deleted or revisited, and listener cleanup.
Client tests import the store normally and exercise Svelte's
reactive runtime to verify that previously evaluated search and calendar views
update, including all earlier visits when a URL's title changes and stable calendar
bounds as the search changes. Mounted App tests click the real deletion, Cancel,
Retry, Refresh history, selection, and day/hour mode controls and assert the
resulting list, calendar, progress, and error states. They mock Chrome APIs and
browser-only boundaries; a small Web Animations stub completes jsdom transitions
without wall-clock delays. Run client tests alone with `npm test -- --project client`.

Grouping tests construct fixed local dates and require no timezone setup for a
normal run. GitHub Actions runs `npm ci` and `npm test` on every pull request and
push to `main`, using UTC, America/Los_Angeles, Asia/Tokyo, and America/Sao_Paulo to
catch differences between local-time and UTC grouping, date labels, and calendar
rendering. Sao Paulo also exercises historical midnight DST transitions in date
ranges. The UTC job also runs `npm run build`. A separate CI job runs
`npm run check`, `npm run lint`, `npm run format:check`, and `npm run fallow:all`
in parallel with the timezone matrix.

The Los Angeles job additionally checks spring-forward normalization and both
occurrences of the repeated fall-back hour. These two tests are skipped in other
time zones. To run the full suite, including DST cases, on macOS/Linux:

```sh
TZ=America/Los_Angeles npm test
```

Run static checks with `npm run check` and build the extension with `npm run build`.

### Large-history benchmark

Run `npm run benchmark:history` to measure real Chrome history API calls against
a disposable synthetic profile with 100,000 URLs and 500,000 visits. It defaults
to Google Chrome on macOS; set `CHROME_PATH` to use another Chrome executable.
The script creates its own profile and extension in a temporary directory and
prints that location along with timings and retained JavaScript heap usage.

See [the benchmark methodology and results](docs/history-performance.md) for
measurements, configuration options, and the scope of the benchmark.

`npm run check` enables JavaScript/TypeScript and Svelte diagnostics, but disables
the embedded CSS language-service diagnostics because that validator does not yet
understand Chrome's `corner-shape` property and `scroll-state()` container queries.
This keeps those rules scoped to their components. Svelte compiler diagnostics
remain enabled, and the production build processes CSS with Lightning CSS, but
these are not a replacement for all CSS lint checks. Remove the diagnostic-source
restriction once the embedded validator supports these features.
