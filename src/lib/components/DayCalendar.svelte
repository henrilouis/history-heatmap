<script lang="ts">
  import type { HistoryByDay } from "../utils/chrome-api";
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

  type WeekRow = {
    days: {
      date: string;
      level: number;
      count: number;
      dayIndex: number;
    }[];
  };

  function organizeCalendar(historyByDay: HistoryByDay) {
    const sortedDates = Object.keys(historyByDay).sort();
    if (sortedDates.length === 0) return { dayNames: [], rows: [] };

    // Find max count for level calculation
    const maxCount = Math.max(
      ...Object.values(historyByDay).map((items) => items.length),
    );

    // Generate localized day names (Mon-Sun)
    const dayNames = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2024, 0, 1 + i); // Jan 1, 2024 is a Monday
      return date.toLocaleDateString(undefined, { weekday: "short" });
    });

    // Group dates by week (rows)
    const weekMap = new Map<string, WeekRow>();

    sortedDates.forEach((dateKey) => {
      const date = new Date(dateKey);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon-Sun (0-6)

      // Calculate week start (Monday)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - dayIndex);
      const weekKey = weekStart.toISOString().split("T")[0];

      const count = historyByDay[dateKey].length;
      const level =
        maxCount === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          days: [],
        });
      }

      weekMap
        .get(weekKey)!
        .days.push({ date: dateKey, level, count, dayIndex });
    });

    // Convert to array and sort by week (newest first)
    const rows = Array.from(weekMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, row]) => row);

    return { dayNames, rows };
  }

  const calendarData = $derived(organizeCalendar(data));
</script>

{#if calendarData.rows.length === 0}
  <div
    style="display: grid; grid-template-columns: repeat(7, 1.5rem); gap: 0.25rem; padding-block:3rem 1.25rem"
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
  <div class="calendar">
    <table>
      <thead>
        <tr>
          {#each calendarData.dayNames as dayName}
            <th>{dayName}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each calendarData.rows as row}
          <tr>
            {#each calendarData.dayNames as _, dayIndex}
              {@const day = row.days.find((d) => d.dayIndex === dayIndex)}
              {#if day}
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
              {:else}
                <td data-level="0"></td>
              {/if}
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
