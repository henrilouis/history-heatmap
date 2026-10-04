<script lang="ts">
  import CountUp from "./CountUp.svelte";
  import StatCard from "./StatCard.svelte";
  import { formatAverage, formatDay, plural } from "./format";
  import type { Insights } from "../../utils/insights";

  let { insights, search }: { insights: Insights; search: string } = $props();

  const totals = $derived(insights.totals);
  const range = $derived(insights.range);
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };
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
      between {formatDay(range.start, dateOptions)} and
      {formatDay(range.end, dateOptions)}
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

  small {
    color: var(--fg-secondary);
    font-size: 0.875rem;
    font-weight: 400;
  }
</style>
