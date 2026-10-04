import { describe, expect, it } from "vitest";
import { siteForUrl } from "./history-stats";

describe("siteForUrl", () => {
  it.each([
    ["https://www.example.com/a?b=c", "example.com"],
    ["http://example.com", "example.com"],
    ["https://docs.example.com/", "docs.example.com"],
    ["http://localhost:5173/", "localhost:5173"],
    ["chrome://settings/privacy", "chrome://settings"],
    ["chrome-extension://abc/index.html", "chrome-extension://abc"],
    ["file:///Users/me/notes.txt", "Local files"],
    ["about:blank", "about:"],
    ["not a url", "not a url"],
  ])("groups %s under %s", (url, site) => {
    expect(siteForUrl(url)).toBe(site);
  });
});
