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

## Flows

**By flow** groups the visits in view (the search results, or the selected days
or hours) into cards in these steps:

1. **Trails.** Visits are linked through Chrome's recorded `referringVisitId`,
   which covers links, reloads, restored pages, and reopened tabs. A trail is
   every visit that leads back to the same first visit. Links are taken from all
   loaded history, so a visit hidden by the search or selection never splits a
   trail. Unknown, self-referencing, and future referrers stay unlinked, and a
   deleted visit removes its links.
2. **Idle splits.** A trail quiet for more than **one hour** ends, so a tab
   revisited later starts a new flow.
3. **Same website.** Flows whose main website is the same and that follow
   within **30 minutes** of each other join, such as pages of one site typed in
   separately. Flows with a search never join on the search engine, so separate
   searches stay apart.
4. **Other visits.** Flows of at most **two visits** that follow within
   **30 minutes** of each other pool into one **Other visits** card, so a burst
   of unrelated pages doesn't become a card each. A small flow without
   neighbours keeps its own card.

Cards and their visits are newest first. A card is titled by the first search
on it, recognised as in Stats, or else its most visited website, and shows its
time span and number of visits. Its identity follows its earliest visit, so a
growing flow keeps its place while history syncs. Navigation metadata comes
from the existing visit requests and requires no additional permissions.

The grouping is part of the page URL (`#/days?group=flow`), kept when switching
views, and changing it doesn't add a history entry.
