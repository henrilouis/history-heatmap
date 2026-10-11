// Word lists for the demo history: plausible pages, titles and searches.

export const GITHUB_REPOS = [
  "sveltejs/svelte",
  "vitejs/vite",
  "microsoft/playwright",
  "oxc-project/oxc",
  "tc39/proposal-temporal",
  "henrilouis/history-heatmap",
  "TanStack/virtual",
  "nodejs/node",
];

export const MDN_PAGES = [
  "Temporal",
  "Intl.DateTimeFormat",
  "CSS container queries",
  "View Transition API",
  "oklch()",
  "light-dark()",
  "ResizeObserver",
  "AbortController",
  "Array.prototype.toSorted()",
  "corner-shape",
  "Popover API",
  "structuredClone()",
];

export const SVELTE_DOCS = [
  "$derived",
  "$state",
  "$effect",
  "$props",
  "snippet",
  "bind",
  "each",
  "await",
];

export const STACK_OVERFLOW = [
  "How to group dates by week in JavaScript",
  "Why does my CSS grid overflow its container",
  "Chrome extension override history page",
  "Svelte 5 $derived not updating",
  "How to debounce input in Svelte",
  "Convert Chrome history timestamp to Date",
  "Sticky header with backdrop-filter blur",
  "Git rebase onto main without conflicts",
];

export const WIKIPEDIA = [
  "Heat map",
  "Data visualization",
  "Edward Tufte",
  "Small multiple",
  "Sparkline",
  "Florence Nightingale",
  "Polar area diagram",
  "Crimean War",
  "John Snow",
  "1854 Broad Street cholera outbreak",
  "Germ theory of disease",
  "Louis Pasteur",
  "Pasteurization",
  "Sourdough",
  "Lactobacillus",
  "Fermentation",
  "Amsterdam",
  "Canals of Amsterdam",
  "Dutch Golden Age",
  "Johannes Vermeer",
  "Girl with a Pearl Earring",
  "Camera obscura",
  "Pinhole camera",
  "History of photography",
  "Lisbon",
  "Tram 28",
  "1755 Lisbon earthquake",
  "Plate tectonics",
  "Calendar",
  "ISO week date",
  "Gregorian calendar",
  "Leap year",
];

export const SEARCHES = [
  "svelte 5 runes",
  "css container queries",
  "temporal api time zone",
  "chrome extension manifest v3",
  "oklch color picker",
  "playwright screenshot",
  "weather amsterdam",
  "flights amsterdam lisbon",
  "sourdough starter ratio",
  "heatmap color scale",
  "git undo last commit",
  "best mechanical keyboard",
  "vite library mode",
  "how long to boil an egg",
  "pasteis de nata recipe",
];

export const VIDEOS = [
  "Svelte 5 in 100 seconds",
  "The surprising history of calendars",
  "How heatmaps lie",
  "Lisbon travel guide",
  "Sourdough for beginners",
  "CSS tricks you didn't know",
  "Lo-fi beats to code to",
  "Why time zones are hard",
  "Building a Chrome extension",
  "Dutch canal houses explained",
];

export const REDDIT = [
  ["r/sveltejs", "Svelte"],
  ["r/webdev", "Web Development"],
  ["r/dataisbeautiful", "Data Is Beautiful"],
  ["r/Sourdough", "Sourdough"],
  ["r/Amsterdam", "Amsterdam"],
  ["r/MechanicalKeyboards", "Mechanical Keyboards"],
];

export const NEWS = [
  ["theguardian.com", "The Guardian"],
  ["nytimes.com", "The New York Times"],
  ["bbc.com", "BBC News"],
  ["nos.nl", "NOS Nieuws"],
];

export const HEADLINES = [
  "City trials car-free Sundays in the centre",
  "Researchers map a century of rainfall",
  "The quiet return of the night train",
  "Inside the race to build better batteries",
  "Why everyone is baking bread again",
  "A new species of frog found in museum drawer",
  "Housing market cools for the third month",
  "The design of a perfect timetable",
  "Ten walks to take before winter",
  "How cities are planting shade",
  "Chess engine beats itself in record match",
  "Museum opens long-hidden archive",
];

export const BLOGS = [
  "overreacted.io",
  "jvns.ca",
  "danluu.com",
  "kottke.org",
  "css-tricks.com",
  "smashingmagazine.com",
  "web.dev",
  "joshwcomeau.com",
  "simonwillison.net",
  "rachelandrew.co.uk",
  "frontendmasters.com",
  "alistapart.com",
  "lea.verou.me",
  "infrequently.org",
  "adactio.com",
  "macwright.com",
  "rauno.me",
  "brr.fyi",
  "paulgraham.com",
  "seriouseats.com",
];

/** Word lists for fictional one-off websites: adjective, noun, TLD. */
export const HOST_WORDS = [
  ["quiet", "tiny", "bright", "slow", "paper", "lazy", "north", "little"],
  ["pixel", "garden", "notes", "lab", "kitchen", "atlas", "signal", "harbor"],
  ["dev", "blog", "io", "net", "org", "page"],
];

export const BLOG_TOPICS = [
  "What I learned building a tiny database",
  "A complete guide to CSS grid",
  "Notes on time zones",
  "The case for boring technology",
  "Designing calm interfaces",
  "How I take notes",
  "Colour spaces for the rest of us",
  "On writing small tools",
  "Fast software is a feature",
  "An interactive guide to flexbox",
  "Why your dates are off by one",
  "Things I wish I knew about caching",
  "Making a heatmap that reads well",
  "The web is fast by default",
  "The best way to make coffee at home",
  "Debugging with curiosity",
];

export const WORK = [
  ["mail.google.com", "/mail/u/0/#inbox", "Inbox (3) - Gmail"],
  ["calendar.google.com", "/calendar/u/0/r/week", "Google Calendar - Week"],
  ["docs.google.com", "/document/d/roadmap", "Q4 roadmap - Google Docs"],
  ["app.slack.com", "/client/T01/C01", "Slack | #frontend"],
  ["linear.app", "/team/HH/active", "Active issues · History heatmap"],
  ["figma.com", "/design/heatmap/Heatmap-redesign", "Heatmap redesign – Figma"],
  ["notion.so", "/Team-wiki-1a2b", "Team wiki"],
];

export const HOUR_WEIGHTS_WEEKDAY = [
  0.4, 0.2, 0.1, 0.05, 0.02, 0.02, 0.2, 0.8, 1.6, 3, 3.4, 3.2, 1.8, 2.6, 3.2, 3,
  2.6, 1.8, 1.2, 1.4, 2.2, 2.6, 2, 1,
];
export const HOUR_WEIGHTS_WEEKEND = [
  0.8, 0.5, 0.3, 0.1, 0.02, 0.02, 0.05, 0.2, 0.6, 1.4, 2.2, 2.6, 2.2, 1.8, 1.8,
  2, 2, 1.6, 1.4, 1.8, 2.6, 2.8, 2.2, 1.4,
];
