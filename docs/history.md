# History behavior

See the [README](../README.md#how-history-is-displayed) for a quick overview.

## Visits and loading

`chrome.history.search()` supplies URLs and their latest titles. The extension
retrieves each URL's individual visit records with `chrome.history.getVisits()`,
using at most eight requests in flight. Repeated visits remain separate in the
list and heatmap. Dates and hours use the current system timezone; Chrome supplies
timestamps, not the timezone originally used when browsing.

Loading reports progress in completed URLs and can be cancelled. A failed visit
request is retried once for that URL. If it fails again, the load shows an error
and Retry rather than displaying partial counts. Starting a new full load cancels
the previous one, and stale results cannot replace the newer load. Chrome calls
already in flight may finish after cancellation, but their results are ignored.

**Delete all visits** removes every visit to a URL, including visits on other days.
A failed deletion preserves the displayed visits and shows an error.

## Live synchronization

Open pages subscribe to Chrome history events while mounted. Listeners are shared
between consumers and removed when the last consumer disconnects.

- Newly visited URLs are refreshed in bounded batches using `getVisits()`,
  preserving earlier visits without reloading all history. Repeated events for a
  URL are coalesced while a load or batch is in flight.
- Events arriving during a full load are queued and reconciled after it succeeds.
  Incremental batches are serialized with the full load to keep the same bounded
  request pool.
- External URL removals immediately disappear from the store, search results,
  and calendar views. Outstanding full-load or incremental results cannot
  resurrect the deleted records. Clearing all history also clears selection.
- Background refresh failures show a separate, non-blocking notice and preserve
  loaded history. The notice clears when affected URLs recover or are removed,
  or when a new full refresh starts.
- After a full load fails or is cancelled, incremental updates wait for a
  successful Retry so they cannot create a partial heatmap. Clearing all history
  establishes an authoritative empty baseline, from which new visits can sync.

## Navigation trails

The graph connects visits using Chrome's recorded `referringVisitId`, with colors
identifying browsing trails rather than tabs. The list stays newest-first, so
newer visits branch upward from older referrers. Hollow dots mark `reload`
transitions, which Chrome also uses for restored pages and reopened tabs.

Each day/time card has a static graph with at most **five connection lanes**;
an extra lane can hold nodes when those lanes are occupied. Solid connections
span at most **80 rows**. Tunnel shadows mark known connections outside the card
or search results, or connections condensed because of these limits.

Unknown referrers remain unconnected. Filtering and deletion never create
inferred shortcuts through missing visits. Navigation metadata comes from the
existing visit requests and requires no additional permissions. Each graph row
has an accessible label describing its relationships, and graph dimensions use
`rem` so they scale with the root font size.
