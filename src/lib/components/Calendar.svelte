<script lang="ts">
  /* 
  There should be 2 views: 
  - Github style calendar view showing days with activity
  - Github style calendar view showing days/hours with activity
  */

  import type { HistoryByDay } from "../utils/chrome-api";
  import type { Attachment } from "svelte/attachments";

  let {
    data,
    selectedMoments = $bindable(),
  }: {
    data: Promise<HistoryByDay>;
    selectedMoments: string[];
  } = $props();

  type WeekData = {
    dayName: string;
    days: {
      date: string;
      level: number;
      count: number;
    }[];
  };

  function organizeCalendar(historyByDay: HistoryByDay) {
    const sortedDates = Object.keys(historyByDay).sort();
    if (sortedDates.length === 0) return { weeks: [], months: [] };

    // Find max count for level calculation
    const maxCount = Math.max(
      ...Object.values(historyByDay).map((items) => items.length)
    );

    // Organize by weeks (Mon-Sun) - localized
    const dayNames = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2024, 0, 1 + i); // Jan 1, 2024 is a Monday
      return date.toLocaleDateString(undefined, { weekday: "short" });
    });
    const weeks: WeekData[] = dayNames.map((dayName) => ({
      dayName,
      days: [],
    }));

    // Fill in the days
    sortedDates.forEach((dateKey) => {
      const date = new Date(dateKey);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      const rowIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon-Sun (0-6)

      const count = historyByDay[dateKey].length;
      const level =
        maxCount === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));

      weeks[rowIndex].days.push({ date: dateKey, level, count });
    });

    // Calculate month headers with colspan
    const months: { name: string; span: number }[] = [];
    if (weeks[0].days.length === 0) return { weeks, months };

    let currentMonth = "";
    let weekCount = 0;

    weeks[0].days.forEach((day) => {
      const monthName = new Date(day.date).toLocaleString("default", {
        month: "short",
      });
      if (monthName !== currentMonth) {
        if (currentMonth) {
          months.push({ name: currentMonth, span: weekCount });
        }
        currentMonth = monthName;
        weekCount = 1;
      } else {
        weekCount++;
      }
    });

    if (currentMonth) {
      months.push({ name: currentMonth, span: weekCount });
    }

    return { weeks, months };
  }

  function toggleSelectedMoment(date: string) {
    const index = selectedMoments.indexOf(date);
    if (index === -1) {
      selectedMoments = [...selectedMoments, date].sort().reverse();
    } else {
      selectedMoments = selectedMoments.filter((_, i) => i !== index);
    }
  }

  const scrollRight: Attachment = (element) => {
    element.scrollLeft = element.scrollWidth;
  };
</script>

{#await data}
  <div id="calendar">
    <p>Loading calendar...</p>
  </div>
{:then historyByDay}
  {@const { weeks, months } = organizeCalendar(historyByDay)}
  <div
    id="calendar"
    class={selectedMoments.length > 0 ? "filtered" : ""}
    {@attach scrollRight}
  >
    <table>
      <thead>
        <tr>
          <th></th>
          {#each months as month}
            <th colspan={month.span}>{month.name}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each weeks as week}
          <tr>
            <th>{week.dayName}</th>
            {#each week.days as day}
              <td
                tabindex="0"
                data-level={day.level}
                data-date={day.date}
                data-selected={selectedMoments.includes(day.date)}
                title="{day.date}: {day.count} visits"
                onclick={() => toggleSelectedMoment(day.date)}
              ></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:catch error}
  <div id="calendar">
    <p>Error loading calendar: {error.message}</p>
  </div>
{/await}

<style>
  #calendar {
    margin-block: 3rem 4rem;
    max-width: calc(100vw - 3rem);
    overflow-y: auto;
  }
  table {
    border-collapse: separate;
    border-spacing: 0.25rem;
    margin: auto;
    table-layout: fixed;
  }
  td {
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
    background-color: var(--el-bg-default);
    border-radius: var(--el-border-radius);
    corner-shape: var(--el-corner-shape);
    cursor: pointer;
    transition: all ease-in-out 50ms;
    &[data-level="0"]:not([data-selected="true"]) {
      background-color: var(--heatmap-color-0);
      pointer-events: none;
    }
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
    &:hover {
      scale: 1.1;
    }
    &:active {
      scale: 1;
    }
    &[data-selected="true"] {
      outline: var(--el-outline-width-selected) solid
        var(--el-outline-color-selected);
      box-shadow: var(--el-box-shadow-selected);
    }
    /* Todo: dim all td's when one or more are selected */
  }
  th {
    font-size: 0.75rem;
    font-weight: 400;
    text-align: left;
  }
</style>
