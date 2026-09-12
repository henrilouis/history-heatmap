# History heatmap

This is a chromium plugin that adds an interactive calendar heatmap to the browser history to allow for getting a better understanding of one's browsing behavior.

Find the plugin [in the chrome web store](https://chromewebstore.google.com/detail/history-heatmap/laddklgjajohacmmgojapiealpgfbfod).

## History data

The heatmap counts individual visits at their recorded local date and hour.
`chrome.history.search()` supplies URLs and their latest titles; the extension
retrieves each URL's visit records with `chrome.history.getVisits()`, with at most
eight requests in flight. Repeated visits remain visible in their original cells.
If a visit request fails, the load shows an error and Retry rather than partial
counts. The history list displays each visit separately; **Delete all visits**
removes every visit to that URL, including visits on other days.

## Development

Use Node.js 24 (also used in CI) and install dependencies with `npm ci`.
`@types/node` intentionally follows major 24 to match that runtime. The toolchain
uses Vitest 5 and TypeScript 6; TypeScript 6 is the newest major currently supported
by `svelte-check`'s peer dependency range.

### Unit tests

Run the Vitest suite once (exits with a nonzero status on failure):

```sh
npm test
```

Run tests in watch mode while developing:

```sh
npm run test:watch
```

Tests live alongside source files as `*.test.ts` and run in Node. Chrome APIs
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

Grouping tests construct fixed local dates and require no timezone setup for a
normal run. GitHub Actions runs `npm ci` and `npm test` on every pull request and
push to `main`, using UTC, America/Los_Angeles, Asia/Tokyo, and America/Sao_Paulo to
catch differences between local-time and UTC grouping, date labels, and calendar
rendering. Sao Paulo also exercises historical midnight DST transitions in date
ranges. The UTC job also runs `npm run build`.

The Los Angeles job additionally checks spring-forward normalization and both
occurrences of the repeated fall-back hour. These two tests are skipped in other
time zones. To run the full suite, including DST cases, on macOS/Linux:

```sh
TZ=America/Los_Angeles npm test
```

Run static checks with `npm run check` and build the extension with `npm run build`.

`npm run check` enables JavaScript/TypeScript and Svelte diagnostics, but disables
the embedded CSS language-service diagnostics because that validator does not yet
understand Chrome's `corner-shape` property and `scroll-state()` container queries.
This keeps those rules scoped to their components. Svelte compiler diagnostics
remain enabled, and the production build processes CSS with Lightning CSS, but
these are not a replacement for all CSS lint checks. Remove the diagnostic-source
restriction once the embedded validator supports these features.
