# History heatmap

This is a chromium plugin that adds an interactive calendar heatmap to the browser history to allow for getting a better understanding of one's browsing behavior.

Find the plugin [in the chrome web store](https://chromewebstore.google.com/detail/history-heatmap/laddklgjajohacmmgojapiealpgfbfod).

## Development

Use Node.js 24 (also used in CI) and install dependencies with `npm ci`.

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
and input preservation.

Grouping tests construct fixed local dates and require no timezone setup for a
normal run. GitHub Actions runs `npm ci` and `npm test` on every pull request and
push to `main`, using UTC, America/Los_Angeles, and Asia/Tokyo to catch differences
between local-time and UTC grouping. The UTC job also runs `npm run build`.

The Los Angeles job additionally checks spring-forward normalization and both
occurrences of the repeated fall-back hour. These two tests are skipped in other
time zones. To run the full suite, including DST cases, on macOS/Linux:

```sh
TZ=America/Los_Angeles npm test
```

Run static checks with `npm run check` and build the extension with `npm run build`.
