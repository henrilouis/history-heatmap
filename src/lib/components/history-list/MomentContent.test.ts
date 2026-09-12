import { render } from "svelte/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MomentContent from "./MomentContent.svelte";
import { historyVisit } from "../../utils/history-fixtures";

beforeEach(() => {
  vi.stubGlobal("chrome", {
    runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
  });
});

describe("individual visit rendering", () => {
  it("shows each visit to the same URL with its own timestamp", () => {
    const earlyTime = new Date(2026, 8, 12, 9, 5);
    const lateTime = new Date(2026, 8, 12, 9, 45);
    const metadata = { id: "same-url", url: "https://example.com/", title: "Example" };
    const { body } = render(MomentContent, {
      props: {
        date: "2026-09-12T09",
        items: [
          historyVisit("late", lateTime, metadata),
          historyVisit("early", earlyTime, metadata),
        ],
        deleteHistoryUrl: () => {},
      },
    });
    const times = [...body.matchAll(/<time\b[^>]*>([\s\S]*?)<\/time>/g)]
      .map(([, time]) => time.replace(/<!--[\s\S]*?-->/g, "").trim());

    expect(times).toEqual([lateTime, earlyTime].map((date) =>
      date.toLocaleTimeString([], { hour: "numeric", minute: "numeric", hour12: false }),
    ));
    expect(body).toContain("Delete all visits");
    expect(body).toContain("including visits on other days");
  });

  it("renders an epoch timestamp and falls back to the URL when a title is missing", () => {
    const visit = historyVisit("epoch", new Date(0));
    const { body } = render(MomentContent, {
      props: { date: "1970-01-01", items: [visit], deleteHistoryUrl: () => {} },
    });
    const time = new Date(0).toLocaleTimeString([], {
      hour: "numeric", minute: "numeric", hour12: false,
    });

    expect(body).toContain(time);
    expect(body).toContain(`>${visit.url}</a>`);
  });
});
