import { describe, expect, it } from "vitest";
import type { HistoryVisit } from "./chrome-api";
import { historyVisit } from "./history-fixtures";
import { flowTitle, groupByFlow } from "./history-flows";
import { indexNavigation } from "./history-navigation";

const START = Date.UTC(2026, 0, 15, 12);

/** A visit `minutes` after noon, opened from `parent` when given. */
const visit = (id: string, minutes: number, url: string, parent = "0") =>
  historyVisit(id, new Date(START + minutes * 60_000), {
    url,
    referringVisitId: parent,
  });

function flows(visits: HistoryVisit[], scope = visits) {
  return groupByFlow(scope, indexNavigation(visits));
}

const ids = (items: HistoryVisit[]) => items.map((item) => item.visitId);

describe("groupByFlow", () => {
  it("groups pages opened from one another across websites, newest first", () => {
    const result = flows([
      visit("root", 0, "https://news.example/"),
      visit("article", 2, "https://blog.example/post", "root"),
      visit("next", 5, "https://blog.example/next", "article"),
    ]);

    expect(result).toEqual([
      {
        key: "flow:root",
        items: expect.any(Array),
        topic: { kind: "site", site: "blog.example" },
      },
    ]);
    expect(ids(result[0].items)).toEqual(["next", "article", "root"]);
  });

  it("names a flow after the search it started with", () => {
    const [flow] = flows([
      visit("search", 0, "https://www.google.com/search?q=Svelte+Runes"),
      visit("docs", 1, "https://svelte.dev/docs", "search"),
      visit("runes", 2, "https://svelte.dev/docs/runes", "docs"),
      visit("refine", 3, "https://www.google.com/search?q=effect", "search"),
    ]);

    expect(flow.topic).toEqual({ kind: "search", term: "svelte runes" });
  });

  it("starts a new flow after the trail has been quiet for over an hour", () => {
    const result = flows([
      visit("a1", 0, "https://a.example/1"),
      visit("a2", 1, "https://a.example/2", "a1"),
      visit("a3", 2, "https://a.example/3", "a2"),
      visit("b1", 63, "https://a.example/4", "a3"),
      visit("b2", 64, "https://a.example/5", "b1"),
      visit("b3", 65, "https://a.example/6", "b2"),
    ]);

    expect(result.map((flow) => flow.key)).toEqual(["flow:b1", "flow:a1"]);
  });

  it("keeps a trail together across midnight", () => {
    const midnight = 12 * 60;
    const result = flows([
      visit("late", midnight - 10, "https://a.example/1"),
      visit("later", midnight - 1, "https://a.example/2", "late"),
      visit("after", midnight + 10, "https://a.example/3", "later"),
    ]);

    expect(result).toHaveLength(1);
  });

  it("joins unrelated trails on the same website that follow closely", () => {
    const result = flows([
      visit("issues", 0, "https://github.com/issues"),
      visit("issue", 1, "https://github.com/issues/1", "issues"),
      visit("pulls", 20, "https://www.github.com/pulls"),
      visit("pull", 21, "https://github.com/pulls/2", "pulls"),
      visit("later", 120, "https://github.com/later"),
      visit("later2", 121, "https://github.com/later/2", "later"),
      visit("later3", 122, "https://github.com/later/3", "later2"),
    ]);

    expect(result.map((flow) => ids(flow.items))).toEqual([
      ["later3", "later2", "later"],
      ["pull", "pulls", "issue", "issues"],
    ]);
    expect(result[1]).toMatchObject({
      key: "flow:issues",
      topic: { kind: "site", site: "github.com" },
    });
  });

  it("keeps separate searches apart even on the same search engine", () => {
    const search = (id: string, minutes: number, term: string) => [
      visit(id, minutes, `https://www.google.com/search?q=${term}`),
      visit(`${id}-1`, minutes + 1, `https://${term}.example/1`, id),
      visit(`${id}-2`, minutes + 2, `https://${term}.example/2`, id),
    ];
    const result = flows([
      ...search("a", 0, "cats"),
      ...search("b", 5, "dogs"),
    ]);

    expect(result.map((flow) => flow.topic)).toEqual([
      { kind: "search", term: "dogs" },
      { kind: "search", term: "cats" },
    ]);
  });

  it("pools a burst of unrelated pages into one card per session", () => {
    const result = flows([
      visit("mail", 0, "https://mail.example/"),
      visit("calendar", 1, "https://calendar.example/"),
      visit("news", 2, "https://news.example/"),
      visit("news-article", 3, "https://news.example/story", "news"),
      visit("weather", 4, "https://weather.example/"),
      visit("evening", 300, "https://evening.example/"),
      visit("evening-2", 301, "https://other.example/"),
    ]);

    expect(result).toEqual([
      {
        key: "other:evening",
        items: expect.any(Array),
        topic: { kind: "other" },
      },
      {
        key: "other:mail",
        items: expect.any(Array),
        topic: { kind: "other" },
      },
    ]);
    expect(ids(result[1].items)).toEqual([
      "weather",
      "news-article",
      "news",
      "calendar",
      "mail",
    ]);
  });

  it("keeps a lone small flow as its own card", () => {
    const result = flows([
      visit("alone", 0, "https://alone.example/"),
      visit("big", 120, "https://big.example/1"),
      visit("big2", 121, "https://big.example/2", "big"),
      visit("big3", 122, "https://big.example/3", "big2"),
    ]);

    expect(result.map((flow) => flow.topic)).toEqual([
      { kind: "site", site: "big.example" },
      { kind: "site", site: "alone.example" },
    ]);
  });

  it("keeps a trail together when an intermediate visit is filtered out", () => {
    const all = [
      visit("root", 0, "https://a.example/"),
      visit("middle", 1, "https://b.example/", "root"),
      visit("leaf", 2, "https://c.example/", "middle"),
      visit("leaf2", 3, "https://c.example/2", "leaf"),
      visit("unrelated", 4, "https://d.example/"),
      visit("unrelated2", 5, "https://e.example/"),
    ];
    const result = flows(
      all,
      all.filter((item) => item.visitId !== "middle"),
    );

    expect(result.map((flow) => ids(flow.items))).toEqual([
      ["unrelated2", "unrelated"],
      ["leaf2", "leaf", "root"],
    ]);
  });

  it("keeps a flow's key as it grows", () => {
    const visits = [
      visit("root", 0, "https://a.example/"),
      visit("one", 1, "https://a.example/1", "root"),
      visit("two", 2, "https://a.example/2", "one"),
    ];
    const before = flows(visits);
    const after = flows([
      ...visits,
      visit("three", 3, "https://a.example/3", "two"),
    ]);

    expect(after[0].key).toBe(before[0].key);
    expect(after[0].items).toHaveLength(4);
  });

  it("orders visits newest first whatever order they are given in", () => {
    const visits = [
      visit("a", 0, "https://a.example/"),
      visit("b", 1, "https://a.example/b", "a"),
      visit("c", 2, "https://a.example/c", "b"),
    ];

    expect(ids(flows([...visits].reverse())[0].items)).toEqual(["c", "b", "a"]);
    expect(ids(flows(visits)[0].items)).toEqual(["c", "b", "a"]);
  });

  it("returns no flows without visits", () => {
    expect(flows([])).toEqual([]);
  });

  it("titles a flow after its topic", () => {
    expect(flowTitle({ kind: "search", term: "svelte runes" })).toBe(
      "“svelte runes”",
    );
    expect(flowTitle({ kind: "site", site: "github.com" })).toBe("github.com");
    expect(flowTitle({ kind: "other" })).toBe("Other visits");
  });
});
