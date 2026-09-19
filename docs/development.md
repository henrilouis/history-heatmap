# Development notes

See the [README](../README.md#development) for setup and everyday commands.

## Runtime and compilers

The project requires Node.js 26 and uses native Temporal. `.npmrc` enables
`engine-strict`, so dependency installation rejects unsupported Node versions.
`@types/node` follows the same major version.

Stable TypeScript 7.0.2 is exact-pinned under the npm alias `typescript-native`.
`npm run check:types` invokes `node_modules/typescript-native/bin/tsc` explicitly
for the app and Vite configurations, avoiding the shared `tsc` binary name with
TypeScript 6. The `typescript` dependency remains on version 6 because
`svelte-check` requires its JavaScript compiler API and supports TypeScript 5 and 6.

`npm run check:svelte` checks component scripts and templates. Its embedded CSS
diagnostics are disabled because that validator does not yet support
`corner-shape` and `scroll-state()` container queries. Stylelint checks CSS, and
the production build processes it with Lightning CSS. Re-enable the embedded CSS
diagnostics when the validator supports those features.

## Linting and formatting

| Configuration       | Scope                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `.oxlintrc.json`    | JavaScript, TypeScript, and Svelte script blocks.                         |
| `.stylelintrc.json` | CSS files and Svelte style blocks via `postcss-html`.                     |
| `.oxfmtrc.json`     | Formatting, including Svelte; excludes generated output and the lockfile. |
| `.fallowrc.json`    | Dead code, duplication, complexity, and styling analysis.                 |

Install the recommended Oxc VS Code extension for editor integration.

Use `rem` for sizing and spacing and `em` for font-relative sizes and media
queries. Stylelint rejects `px`; necessary exceptions need a narrowly scoped
disable with a reason:

```css
/* stylelint-disable-next-line unit-disallowed-list -- Keep this hairline exactly one CSS pixel. */
border-width: 1px;
```

Unused disables fail linting. Inline styles and JavaScript strings should follow
the same unit conventions, except where browser APIs require pixels.

## Fallow and pre-commit checks

Installing dependencies configures `simple-git-hooks` to run an incremental
Fallow audit against `HEAD`. Newly introduced findings block commits; inherited
findings do not. The hook analyzes the working tree rather than the staged
snapshot, so partial staging can include unrelated findings or hide staged
issues. CI runs the full audit on the checked-out commit.

Fallow configuration includes these toolchain exceptions:

- `svelte.config.js` is an entry point because tools load it implicitly.
- `svelte` is excluded from unused-dependency checks because Vite bundles it.
- `postcss-html` is excluded because Stylelint loads it by name from configuration.
- `typescript-native` is excluded because the compiler script invokes its file path.

Duplication findings require three occurrences. Fallow is exact-pinned, with
weekly Dependabot checks for updates.
