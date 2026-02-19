<script lang="ts">
  import type { HistoryByDay } from "../../utils/chrome-api";
  import type { Attachment } from "svelte/attachments";
  import "./calendar.css";

  let {
    data,
    selectedMoments,
    onToggleMoment,
  }: {
    data: HistoryByDay;
    selectedMoments: string[];
    onToggleMoment: (date: string) => void;
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
      ...Object.values(historyByDay).map((items) => items.length),
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

  const calendarData = $derived(organizeCalendar(data));
  const weeks = $derived(calendarData.weeks);
  const months = $derived(calendarData.months);

  const scrollRight: Attachment = (element) => {
    element.scrollLeft = element.scrollWidth;
  };
</script>

{#if weeks.length === 0}
  <div
    style="display: grid; grid-template-rows: repeat(9, 1.5rem); gap: 0.25rem; padding-block:3rem 1.25rem"
  >
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
    <div class="skeleton"></div>
  </div>
{:else}
  <div class="calendar" {@attach scrollRight}>
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
                tabindex={day.count > 0 || selectedMoments.includes(day.date)
                  ? 0
                  : -1}
                data-level={day.level}
                data-date={day.date}
                data-selected={selectedMoments.includes(day.date)}
                title="{day.date}: {day.count} visits"
                onclick={() => onToggleMoment(day.date)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleMoment(day.date);
                  }
                }}
              ></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  td {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
