// Seeded, synthetic browsing history for store screenshots. The same seed,
// time zone and end time always produce the same history.
import {
  BLOG_TOPICS,
  BLOGS,
  GITHUB_REPOS,
  HEADLINES,
  HOST_WORDS,
  HOUR_WEIGHTS_WEEKDAY,
  HOUR_WEIGHTS_WEEKEND,
  MDN_PAGES,
  NEWS,
  REDDIT,
  SEARCHES,
  STACK_OVERFLOW,
  SVELTE_DOCS,
  VIDEOS,
  WIKIPEDIA,
  WORK,
} from "./demo-catalog.mjs";

/** Small, fast, seedable PRNG (mulberry32). */
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p) => next() < p,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    /** An item from a list, favouring the front like real page popularity. */
    zipf: (list, exponent = 1.1) =>
      list[
        weightedIndex(
          next,
          list.map((_, i) => 1 / (i + 1) ** exponent),
        )
      ],
    /** The first element of a [value, weight] entry, chosen by weight. */
    weighted: (entries) =>
      entries[
        weightedIndex(
          next,
          entries.map((entry) => entry[1]),
        )
      ][0],
  };
}

function weightedIndex(next, weights) {
  let roll = next() * weights.reduce((sum, weight) => sum + weight, 0);
  const index = weights.findIndex((weight) => (roll -= weight) < 0);
  return index === -1 ? weights.length - 1 : index;
}

const slug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const googleSearch = (term) => [
  `https://www.google.com/search?q=${encodeURIComponent(term).replaceAll("%20", "+")}`,
  `${term} - Google Search`,
];

/** Page factories for coding sessions, by weight. Each gets (random, repo). */
const DEV_PAGES = [
  [
    (random, repo) => {
      const number = random.int(40, 160);
      return [
        `https://github.com/${repo}/pull/${number}`,
        `Pull request #${number} · ${repo}`,
      ];
    },
    30,
  ],
  [
    (random) => {
      const page = random.zipf(MDN_PAGES);
      return [
        `https://developer.mozilla.org/en-US/docs/Web/${slug(page)}`,
        `${page} - Web APIs | MDN`,
      ];
    },
    20,
  ],
  [
    (random) => {
      const question = random.zipf(STACK_OVERFLOW);
      const id = 7_000_000 + STACK_OVERFLOW.indexOf(question);
      return [
        `https://stackoverflow.com/questions/${id}/${slug(question)}`,
        `${question} - Stack Overflow`,
      ];
    },
    15,
  ],
  [
    (random) => {
      const topic = random.zipf(SVELTE_DOCS);
      return [
        `https://svelte.dev/docs/svelte/${topic}`,
        `${topic} • Svelte Docs`,
      ];
    },
    15,
  ],
  [(_, repo) => [`https://github.com/${repo}/issues`, `Issues · ${repo}`], 10],
  [() => ["https://www.npmjs.com/package/vite", "vite - npm"], 10],
];

/**
 * Session kinds: how many pages they span, and how they start. `start`
 * returns the opening pages and a function producing each following page.
 */
const SESSION_KINDS = {
  dev: {
    length: [3, 12],
    start: ({ random }) => {
      const repo = random.zipf(GITHUB_REPOS);
      return {
        first: [[`https://github.com/${repo}`, `GitHub - ${repo}`]],
        next: () => random.weighted(DEV_PAGES)(random, repo),
      };
    },
  },
  news: {
    length: [2, 7],
    start: (context) =>
      context.random.chance(0.55)
        ? {
            first: [["https://news.ycombinator.com/", "Hacker News"]],
            next: context.blogPost,
          }
        : outletSession(context.random),
  },
  work: {
    length: [1, 5],
    start: ({ random }) => ({
      first: [],
      next: () => {
        const [host, path, title] = random.zipf(WORK, 0.9);
        return [`https://${host}${path}`, title];
      },
    }),
  },
  wiki: {
    length: [3, 10],
    start: ({ random }) => {
      let index = random.int(0, WIKIPEDIA.length - 1);
      return {
        first: random.chance(0.5) ? [googleSearch(WIKIPEDIA[index])] : [],
        next: () => {
          const article = WIKIPEDIA[index % WIKIPEDIA.length];
          index += random.int(1, 2);
          return [
            `https://en.wikipedia.org/wiki/${article.replaceAll(" ", "_")}`,
            `${article} - Wikipedia`,
          ];
        },
      };
    },
  },
  video: {
    length: [2, 6],
    start: ({ random }) => {
      const term = random.pick(VIDEOS).toLowerCase();
      const results = [
        `https://www.youtube.com/results?search_query=${term.replaceAll(" ", "+")}`,
        `${term} - YouTube`,
      ];
      return {
        first: [
          ["https://www.youtube.com/", "YouTube"],
          ...(random.chance(0.5) ? [results] : []),
        ],
        next: () => {
          const video = random.zipf(VIDEOS, 0.8);
          return [
            `https://www.youtube.com/watch?v=demo${VIDEOS.indexOf(video).toString(36)}`,
            `${video} - YouTube`,
          ];
        },
      };
    },
  },
  social: {
    length: [2, 8],
    start: ({ random, blogPost }) => {
      const [path, name] = random.zipf(REDDIT);
      const thread = () => {
        const headline = random.pick(HEADLINES);
        return [
          `https://www.reddit.com/${path}/comments/${slug(headline)}/`,
          `${headline} : ${path}`,
        ];
      };
      return {
        first: [[`https://www.reddit.com/${path}/`, `${name} - Reddit`]],
        next: () => (random.chance(0.4) ? blogPost() : thread()),
      };
    },
  },
  music: {
    length: [1, 2],
    start: () => ({
      first: [["https://open.spotify.com/", "Spotify – Web Player"]],
      next: () => [
        "https://open.spotify.com/playlist/focus",
        "Deep Focus | Spotify Playlist",
      ],
    }),
  },
  search: {
    length: [2, 4],
    start: ({ random, blogPost }) => ({
      first: [googleSearch(random.zipf(SEARCHES, 0.9))],
      next: blogPost,
    }),
  },
};

function outletSession(random) {
  const [host, name] = random.zipf(NEWS);
  return {
    first: [[`https://www.${host}/`, name]],
    next: () => {
      const headline = random.pick(HEADLINES);
      return [`https://www.${host}/${slug(headline)}`, `${headline} | ${name}`];
    },
  };
}

/** Which sessions happen when; work dominates weekday working hours. */
const SESSION_MIX = {
  night: [
    ["video", 4],
    ["wiki", 2],
    ["social", 3],
    ["dev", 1],
  ],
  work: [
    ["dev", 8],
    ["work", 6],
    ["search", 3],
    ["news", 2],
    ["music", 1],
    ["social", 1],
    ["wiki", 1],
  ],
  leisure: [
    ["news", 4],
    ["video", 4],
    ["social", 3],
    ["wiki", 2],
    ["search", 3],
    ["dev", 2],
    ["music", 1],
    ["work", 1],
  ],
};
const WORK_HOURS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]);

function sessionMix(hour, weekend) {
  if (hour < 6) return SESSION_MIX.night;
  if (!weekend && WORK_HOURS.has(hour)) return SESSION_MIX.work;
  return SESSION_MIX.leisure;
}

/** Share of sessions opened from a bookmark rather than typed. */
const BOOKMARKED = { music: 0.6, work: 0.6 };

function sessionPages(context, kind) {
  const { length, start } = SESSION_KINDS[kind];
  const count = context.random.int(...length);
  const { first, next } = start(context);
  const pages = first.slice(0, count);
  while (pages.length < count) pages.push(next());
  // Repeats come from reloads and later sessions, not back-to-back clicks.
  return pages.filter((page, i) => i === 0 || page[0] !== pages[i - 1][0]);
}

/** How a page was reached: [transition, referring visit ID]. */
function arrival({ random }, kind, url, previous) {
  return previous.length
    ? followLink(random, previous)
    : openSession(random, kind, url);
}

/** Mostly follow the last page; sometimes branch from an earlier one. */
function followLink(random, previous) {
  return ["link", random.chance(0.8) ? previous.at(-1) : random.pick(previous)];
}

function openSession(random, kind, url) {
  if (url.includes("google.com/search")) return ["generated", "0"];
  const bookmarked = random.chance(BOOKMARKED[kind] ?? 0.3);
  return [bookmarked ? "auto_bookmark" : "typed", "0"];
}

/** Collects visits per URL in the shape chrome.history returns them. */
function createRecorder() {
  const urls = new Map();
  let nextVisitId = 1;

  function record(url, title, visitTime, [transition, referringVisitId]) {
    if (!urls.has(url)) {
      urls.set(url, { id: String(urls.size + 1), url, title, visits: [] });
    }
    const entry = urls.get(url);
    const visitId = String(nextVisitId++);
    entry.visits.push({
      id: entry.id,
      visitId,
      visitTime,
      referringVisitId,
      transition,
      isLocal: true,
    });
    return visitId;
  }

  function toChromeHistory() {
    const entries = [...urls.values()];
    const items = entries
      .map(({ id, url, title, visits }) => ({
        id,
        url,
        title,
        lastVisitTime: Math.max(...visits.map((visit) => visit.visitTime)),
        visitCount: visits.length,
        typedCount: visits.filter((visit) => visit.transition === "typed")
          .length,
      }))
      .sort((a, b) => b.lastVisitTime - a.lastVisitTime);
    const visitsByUrl = Object.fromEntries(
      entries.map(({ url, visits }) => [url, visits]),
    );
    return { items, visitsByUrl };
  }

  return { record, toChromeHistory };
}

function recordSession(context, kind, startTime) {
  const { random, recorder, endTime } = context;
  const ids = [];
  let time = startTime;
  for (const [url, title] of sessionPages(context, kind)) {
    if (time > endTime) return;
    const visitId = recorder.record(
      url,
      title,
      time,
      arrival(context, kind, url, ids),
    );
    ids.push(visitId);
    if (random.chance(0.04)) {
      time += random.int(5, 60) * 1000;
      recorder.record(url, title, time, ["reload", visitId]);
    }
    time += random.int(20, 240) * 1000;
  }
}

/**
 * Sessions on a day: a slow seasonal swell plus skewed day-to-day noise, so
 * most days are ordinary with the occasional very busy one.
 */
function sessionCount(random, weekend, holiday, progress) {
  const season = 1 + 0.25 * Math.sin(progress * Math.PI * 4);
  const base = (weekend ? 5 : 10) * (holiday ? 0.3 : 1) * season;
  const busy = random.chance(0.03) ? 1.5 : 1;
  return Math.max(
    1,
    Math.round(base * busy * (0.4 + 1.2 * random.next() ** 1.5)),
  );
}

/** Local start times of a day's sessions, in order. */
function sessionStarts(random, date, count, weekend) {
  const hourWeights = weekend ? HOUR_WEIGHTS_WEEKEND : HOUR_WEIGHTS_WEEKDAY;
  return Array.from({ length: count }, () =>
    date.toPlainDateTime({
      hour: weightedIndex(random.next, hourWeights),
      minute: random.int(0, 59),
      second: random.int(0, 59),
    }),
  ).sort(Temporal.PlainDateTime.compare);
}

function recordDay(context, date, progress, holiday) {
  const { random, timeZone } = context;
  // Holidays and a few scattered days off leave gaps, as in a real year.
  if (random.chance(holiday ? 0.8 : 0.04)) return;
  const weekend = date.dayOfWeek >= 6;
  const count = sessionCount(random, weekend, holiday, progress);

  for (const start of sessionStarts(random, date, count, weekend)) {
    const kind = random.weighted(sessionMix(start.hour, weekend));
    recordSession(
      context,
      kind,
      start.toZonedDateTime(timeZone).epochMilliseconds,
    );
  }
}

/**
 * @param {{ seed?: number, timeZone: string, end: string, days?: number }} options
 *   `end` is the local date-time of the last possible visit, e.g. 2026-10-09T17:20.
 */
export function generateDemoHistory({
  seed = 20261009,
  timeZone,
  end,
  days = 371,
}) {
  const random = createRandom(seed);
  const endTime = Temporal.PlainDateTime.from(end).toZonedDateTime(timeZone);
  const firstDay = endTime.toPlainDate().subtract({ days: days - 1 });
  const usedHosts = new Set();

  /** A fictional small website such as quiet-pixel.dev, new to the history. */
  const newHost = () => {
    const host = `${random.pick(HOST_WORDS[0])}-${random.pick(HOST_WORDS[1])}.${random.pick(HOST_WORDS[2])}`;
    const fresh = !usedHosts.has(host);
    usedHosts.add(host);
    return fresh ? host : random.pick(BLOGS);
  };

  const context = {
    random,
    timeZone,
    endTime: endTime.epochMilliseconds,
    recorder: createRecorder(),
    // Some links lead somewhere new, so websites keep being discovered through
    // the year and many are only ever visited once.
    blogPost: () => {
      const host = random.chance(0.12) ? newHost() : random.pick(BLOGS);
      const topic = random.pick(BLOG_TOPICS);
      return [`https://${host}/${slug(topic)}/`, `${topic} — ${host}`];
    },
  };

  // A two-week summer holiday.
  const holidayStart = random.int(250, 270);
  for (let offset = 0; offset < days; offset++) {
    const holiday = offset >= holidayStart && offset < holidayStart + 12;
    recordDay(context, firstDay.add({ days: offset }), offset / days, holiday);
  }
  return context.recorder.toChromeHistory();
}
