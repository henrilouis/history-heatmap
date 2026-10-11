/**
 * Runs in the page before the app loads (Playwright serializes it with
 * `toString`, so it must not reference anything outside its own body).
 * Provides the slice of the extension APIs the app uses, backed by demo data,
 * and pins `Temporal.Now` so streaks and "today" don't depend on the machine.
 */
export function installFakeChrome({ items, visitsByUrl, now }) {
  const instant = Temporal.Instant.fromEpochMilliseconds(now);
  const zoned = (timeZone = Temporal.Now.timeZoneId()) =>
    instant.toZonedDateTimeISO(timeZone);
  Object.assign(Temporal.Now, {
    instant: () => instant,
    zonedDateTimeISO: zoned,
    plainDateTimeISO: (timeZone) => zoned(timeZone).toPlainDateTime(),
    plainDateISO: (timeZone) => zoned(timeZone).toPlainDate(),
    plainTimeISO: (timeZone) => zoned(timeZone).toPlainTime(),
  });

  // Chrome answers asynchronously; keep that so loading behaves as it does live.
  const reply = (callback, value) => setTimeout(() => callback(value));
  const listeners = { addListener() {}, removeListener() {} };

  globalThis.chrome = {
    runtime: {
      lastError: undefined,
      // Same-origin so the screenshot script can serve icons via page.route.
      getURL: (path) => new URL(path, location.origin).toString(),
    },
    history: {
      search({ text = "", startTime = 0, maxResults = 100 }, callback) {
        const needle = text.toLowerCase();
        const results = items
          .filter(
            (item) =>
              item.lastVisitTime >= startTime &&
              (!needle ||
                item.url.toLowerCase().includes(needle) ||
                item.title.toLowerCase().includes(needle)),
          )
          .slice(0, maxResults);
        reply(callback, results);
      },
      getVisits({ url }, callback) {
        reply(callback, visitsByUrl[url] ?? []);
      },
      deleteUrl(_details, callback) {
        reply(callback);
      },
      onVisited: listeners,
      onVisitRemoved: listeners,
    },
  };
}
