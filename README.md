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
