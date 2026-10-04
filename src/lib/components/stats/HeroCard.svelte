<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatAverage, formatDay, plural } from "./format";
  import type { Insights } from "../../utils/insights";

  let { insights, search }: { insights: Insights; search: string } = $props();

  const totals = $derived(insights.totals);
  const range = $derived(insights.range);
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };

  // Same levels as the heatmap: 0 for no visits, then quarters of the busiest.
  const days = $derived.by(() => {
    const max = Math.max(1, ...insights.dailyVisits);
    return insights.dailyVisits.map((visits, offset) => ({
      visits,
      level: visits && Math.min(4, Math.ceil((visits / max) * 4)),
      label: `${formatDay((range?.start ?? 0) + offset, dateOptions)}: ${plural(visits, "visit")}`,
    }));
  });
</script>

<StatCard
  span={6}
  variant="hero"
  eyebrow={search ? `Your “${search}” history` : "Your browsing history"}
>
  <p class="headline hero-headline">
    <CountUp value={totals.visits} />
    {totals.visits === 1 ? "visit" : "visits"}
  </p>
  <p class="caption hero-caption">
    to {plural(totals.pages, "page")} on {plural(totals.sites, "website")}
    {#if range}
      over {plural(range.days, "day")}
    {/if}
  </p>
  <dl class="figures">
    <div>
      <dt>Pages</dt>
      <dd><CountUp value={totals.pages} /></dd>
    </div>
    <div>
      <dt>Websites</dt>
      <dd><CountUp value={totals.sites} /></dd>
    </div>
    {#if range}
      <div>
        <dt>Days with visits</dt>
        <dd>
          <CountUp value={totals.activeDays} />
          <small>of {range.days.toLocaleString()}</small>
        </dd>
      </div>
      <div>
        <dt>Visits per active day</dt>
        <dd>
          <CountUp
            value={totals.visits / Math.max(1, totals.activeDays)}
            format={formatAverage}
          />
        </dd>
      </div>
    {/if}
  </dl>
  {#if range && days.length > 1}
    <figure class="days">
      <ol
        style:--days={days.length}
        role="img"
        aria-label="Visits per day from {formatDay(
          range.start,
          dateOptions,
        )} to {formatDay(range.end, dateOptions)}"
      >
        {#each days as day, index (index)}
          <li
            data-level={day.level}
            title={day.label}
            style:--delay={index / days.length}
          ></li>
        {/each}
      </ol>
      <figcaption>
        <span>{formatDay(range.start, dateOptions)}</span>
        <span>{formatDay(range.end, dateOptions)}</span>
      </figcaption>
    </figure>
  {/if}
</StatCard>

<style>
  p.hero-headline {
    font-size: clamp(2.5rem, 12cqi, 5rem);
  }

  p.hero-caption {
    font-size: 1.125rem;
    text-wrap: balance;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1rem;
    margin: 1rem 0 0;
  }

  dt {
    color: var(--fg-secondary);
    font-size: var(--el-font-size);
  }

  dd {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .days {
    margin: 1.5rem 0 0;
  }

  .days ol {
    display: grid;
    grid-template-columns: repeat(var(--days), minmax(0, 1fr));
    /* Gaps shrink with the cells, so a long history stays a solid strip. */
    gap: min(0.1875rem, calc(20cqi / var(--days)));
    height: 3rem;
  }

  .days li {
    background-color: var(--heatmap-color-0);
    border-radius: min(0.25rem, calc(25cqi / var(--days)));

    &[data-level="1"] {
      background-color: var(--heatmap-color-1);
    }

    &[data-level="2"] {
      background-color: var(--heatmap-color-2);
    }

    &[data-level="3"] {
      background-color: var(--heatmap-color-3);
    }

    &[data-level="4"] {
      background-color: var(--heatmap-color-4);
    }
  }

  figcaption {
    display: flex;
    justify-content: space-between;
    margin-block-start: 0.375rem;
    color: var(--fg-secondary);
    font-size: var(--el-font-size);
  }

  @media (prefers-reduced-motion: no-preference) {
    .days li {
      animation: pop 0.3s ease-out both;
      animation-delay: calc(var(--delay) * 0.8s);
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      scale: 1 0.2;
    }
  }

  small {
    color: var(--fg-secondary);
    font-size: 0.875rem;
    font-weight: 400;
  }
</style>
