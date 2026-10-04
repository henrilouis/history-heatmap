<script lang="ts">
  import Card from "../history-list/Card.svelte";
  import BusiestDayCard from "./BusiestDayCard.svelte";
  import DeepDiveCard from "./DeepDiveCard.svelte";
  import DiscoveryCurveCard from "./DiscoveryCurveCard.svelte";
  import HeroCard from "./HeroCard.svelte";
  import HoursCard from "./HoursCard.svelte";
  import LateNightCard from "./LateNightCard.svelte";
  import LoyaltyCard from "./LoyaltyCard.svelte";
  import MostRevisitedCard from "./MostRevisitedCard.svelte";
  import OneAndDoneCard from "./OneAndDoneCard.svelte";
  import PersonalityCard from "./PersonalityCard.svelte";
  import RabbitHoleCard from "./RabbitHoleCard.svelte";
  import RegularsCard from "./RegularsCard.svelte";
  import SearchesCard from "./SearchesCard.svelte";
  import StreakCard from "./StreakCard.svelte";
  import TopSitesCard from "./TopSitesCard.svelte";
  import TransitionsCard from "./TransitionsCard.svelte";
  import WeekdaysCard from "./WeekdaysCard.svelte";
  import { historyStore } from "../../stores/history.svelte";
  import { buildInsights } from "../../utils/insights";

  const insights = $derived(
    buildInsights(historyStore.filtered, {
      allVisits: historyStore.raw,
      navigation: historyStore.navigation,
    }),
  );
</script>

<section class="stats">
  {#if historyStore.isLoading}
    <Card loading={true} />
  {:else if insights.totals.visits === 0}
    <Card>
      <h3>No results found</h3>
    </Card>
  {:else}
    <!-- Story order; cards without enough data leave themselves out. -->
    <div class="grid">
      <HeroCard {insights} search={historyStore.search} />
      <TopSitesCard sites={insights.topSites} />
      <PersonalityCard personality={insights.personality} />
      <WeekdaysCard rhythm={insights.rhythm} />
      <HoursCard rhythm={insights.rhythm} />
      <OneAndDoneCard discovery={insights.discovery} />
      <DeepDiveCard discovery={insights.discovery} />
      <DiscoveryCurveCard discovery={insights.discovery} />
      <LoyaltyCard discovery={insights.discovery} />
      <RegularsCard
        regulars={insights.discovery?.regulars}
        days={insights.range?.days ?? 0}
      />
      <BusiestDayCard busiest={insights.busiestDay} />
      <StreakCard streaks={insights.streaks} />
      <RabbitHoleCard hole={insights.rabbitHole} />
      <LateNightCard late={insights.lateNight} />
      <MostRevisitedCard page={insights.mostRevisited} />
      <TransitionsCard transitions={insights.transitions} />
      <SearchesCard searches={insights.searches} />
    </div>
  {/if}
</section>

<style>
  .stats {
    margin-block-start: 1rem;
    container: stats / inline-size;
  }

  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-flow: row dense;
    gap: 1rem;
  }

  @container stats (width >= 40rem) {
    .grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  h3 {
    margin-block-end: 0.25rem;
  }
</style>
