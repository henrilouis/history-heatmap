# History heatmap

A Chromium extension for visualizing and managing your browsing history with an
interactive calendar heatmap.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/history-heatmap/laddklgjajohacmmgojapiealpgfbfod).
Requires Chrome 144 or newer for native Temporal support.

Existing users on older Chrome versions keep their installed extension version
but stop receiving updates until Chrome meets the minimum version. See
[Chrome's minimum-version enforcement](https://developer.chrome.com/docs/extensions/reference/manifest/minimum-chrome-version#existing_installs).

## How history is displayed

- Each visit appears separately in the list and heatmap, including repeated visits
  to the same URL.
- Dates and hours use your current system timezone, not the timezone where you
  originally browsed.
- Open pages stay synchronized with new visits and external history deletions.
- Loading shows progress and can be cancelled. Failed loads offer Retry;
  background refresh failures preserve the history already displayed.
- **Delete all visits** removes every visit to a URL, including visits on other days.

### Stats

The **Stats** view replaces the heatmap and history list with a Wrapped-style
page of insight cards across all loaded history, filtered by the current search:
top websites, a browsing personality, weekday and hour rhythm, discovery and
returning websites, regulars, highlights such as the busiest day, streaks and
the deepest rabbit hole, and top searches. Websites group by host, with `www.`
merged into the bare domain. Averages span every day in the loaded history,
including days without visits.

### Navigation trails

A subway-style graph connects visits using Chrome's recorded referring visits.
Colors identify browsing trails, not tabs; branches show one visit leading to
others. The list stays newest-first, with newer visits branching upward. Hollow
dots mark reloads, which can also represent restored pages or reopened tabs.
Tunnel shadows indicate known connections outside the current card or search
results, or connections condensed to keep the graph compact. Unknown referrers
remain unconnected. The graph includes accessible labels and requires no
additional permissions.

See [history behavior](docs/history.md) for loading guarantees, synchronization,
and navigation graph limits.

## Development

Use Node.js 26, as pinned in `.nvmrc`:

```sh
nvm install
nvm use
npm ci
```

Start the development server after setup:

```sh
npm run dev
```

### Commands

| Command                           | Purpose                                                              |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | Start the development server.                                        |
| `npm run build`                   | Build the extension into `dist/`.                                    |
| `npm run preview`                 | Preview the production build locally.                                |
| `npm test`                        | Run all unit and component tests.                                    |
| `npm run test:watch`              | Rerun tests as files change.                                         |
| `npm test -- --project client`    | Run Svelte interaction and reactivity tests in jsdom.                |
| `TZ=America/Los_Angeles npm test` | Run all tests, including timezone-specific DST cases (macOS/Linux).  |
| `npm run check`                   | Run TypeScript and Svelte diagnostics.                               |
| `npm run lint`                    | Check scripts and styles with Oxlint and Stylelint.                  |
| `npm run lint:fix`                | Apply automatic lint fixes.                                          |
| `npm run format`                  | Format files with Oxfmt.                                             |
| `npm run format:check`            | Check formatting without changing files.                             |
| `npm run fallow`                  | Audit new issues relative to `HEAD`.                                 |
| `npm run fallow:all`              | Audit the entire project for dead code, duplication, and complexity. |
| `npm run check:versions`          | Check that `package.json` and the manifest share one version.        |
| `npm run screenshots`             | Regenerate the Chrome Web Store screenshots and promo tile.          |

### Testing and CI

Tests live alongside source files and cover history loading, synchronization,
deletion, calendar/date handling, navigation trails, and UI interactions.
Chrome APIs are mocked; tests do not access your browsing history.

CI runs tests in UTC, Los Angeles, Tokyo, and São Paulo, plus type checks,
lint, formatting, the full Fallow audit, and a production build.

### Tooling notes

- TypeScript 7 runs compiler checks. TypeScript 6 is retained for
  `svelte-check` compatibility.
- Styles use `rem` for sizing and `em` for media queries. Stylelint enforces
  the unit rules.
- Installing dependencies sets up the Fallow pre-commit hook. It checks the
  working tree, including unstaged changes, against `HEAD`.
  Run `npm run prepare` to reinstall it.

See [development notes](docs/development.md) for compiler setup, lint configuration,
and pre-commit behavior.

### Benchmark

`npm run benchmark:history` measures Chrome history API performance using a
temporary profile with 100,000 URLs and 500,000 visits.

See [benchmark methodology and results](docs/history-performance.md).

## Releasing

Merging to `main` publishes automatically when the version is new:

1. Bump `version` in both `package.json` and `public/manifest.json` in your PR
   (CI fails if they differ).
2. Merge. The [release workflow](.github/workflows/release.yml) sees that no
   `v<version>` tag exists, runs the checks, builds and zips `dist/`, uploads it
   with the Chrome Web Store API (V2), and submits it to publish as soon as
   review approves it. It then tags `v<version>` and creates a GitHub release
   with the zip and store images attached.

Merges without a version bump do nothing. A failed release creates no tag, so
re-running the workflow retries it. The store accepts one submission in review
at a time; a new version merged meanwhile fails to upload until review
finishes, then can be re-run from the Actions tab.

### Store images

`npm run screenshots` renders the five 1280x800 screenshots and the 440x280
small promo tile into `docs/store/`. It builds the extension, serves it with
seeded demo history in place of the Chrome APIs (your own history is never
read), and captures it with your installed Chrome via Playwright. Output is
deterministic, so unchanged UI produces identical files. Set `CHROME_PATH` to
use another Chrome binary.

The Chrome Web Store API cannot update listing images or text, so after
regenerating, upload `docs/store/` by hand under **Store listing** in the
Developer Dashboard.

### One-time setup

1. In Google Cloud, enable the **Chrome Web Store API**, create a service
   account and a JSON key for it.
2. In the Chrome Web Store Developer Dashboard, add the service account's email
   on the **Account** page, and note the publisher ID.
3. Add repository secrets: `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`
   (`laddklgjajohacmmgojapiealpgfbfod`), and `CWS_SERVICE_ACCOUNT_KEY` (the
   JSON key).

`node scripts/publish-chrome-web-store.mjs <zip>` can also run locally with the
same variables, or with `CWS_ACCESS_TOKEN` instead of a key.
