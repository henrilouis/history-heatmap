<script lang="ts">
  import type { HistoryByDayAndHour } from "../utils/chrome-api";
  import "./calendar.css";

  let {
    data,
    selectedMoments,
    onToggleMoment,
  }: {
    data: HistoryByDayAndHour;
    selectedMoments: string[];
    onToggleMoment: (key: string) => void;
  } = $props();

  // Generate hour-based key for selection
  function getHourKey(date: string, hour: number): string {
    return `${date}T${String(hour).padStart(2, "0")}`;
  }

  type DayRow = {
    date: string;
    cells: {
      hour: number;
      level: number;
      count: number;
      key: string;
    }[];
  };

  type CalendarData = {
    hourLabels: string[];
    rows: DayRow[];
  };

  function organizeCalendarData(
    historyByDayAndHour: HistoryByDayAndHour,
  ): CalendarData {
    const sortedDates = Object.keys(historyByDayAndHour).sort().reverse();
    if (sortedDates.length === 0) {
      return { hourLabels: [], rows: [] };
    }

    // Generate hour labels for header (0-23)
    const hourLabels = Array.from({ length: 24 }, (_, hour) =>
      String(hour).padStart(2, "0"),
    );

    // Find max count for level calculation
    let maxCount = 0;
    for (const day of Object.values(historyByDayAndHour)) {
      for (const items of Object.values(day)) {
        maxCount = Math.max(maxCount, items.length);
      }
    }

    // Generate rows (one per day)
    const rows: DayRow[] = sortedDates.map((dateKey) => {
      return {
        date: dateKey,
        cells: Array.from({ length: 24 }, (_, hour) => {
          const hourKey = String(hour).padStart(2, "0");
          const count = historyByDayAndHour[dateKey]?.[hourKey]?.length ?? 0;
          const level =
            maxCount === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
          return {
            hour,
            level,
            count,
            key: getHourKey(dateKey, hour),
          };
        }),
      };
    });

    return { hourLabels, rows };
  }

  const calendarData = $derived(organizeCalendarData(data));
</script>

{#if calendarData.rows.length === 0}
  <p>No history data available to display the calendar.</p>
{:else}
  <div class="calendar">
    <table>
      <thead>
        <tr class="hours">
          {#each calendarData.hourLabels as hour}
            <th>{hour}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each calendarData.rows as row}
          <tr>
            {#each row.cells as cell}
              <td
                tabindex={cell.count > 0 || selectedMoments.includes(cell.key)
                  ? 0
                  : -1}
                data-level={cell.level}
                data-selected={selectedMoments.includes(cell.key)}
                title="{row.date} {String(cell.hour).padStart(
                  2,
                  '0',
                )}:00: {cell.count} visits"
                onclick={() => onToggleMoment(cell.key)}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggleMoment(cell.key);
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
    min-width: 0.75rem;
    max-width: 0.75rem;
    min-height: 0.75rem;
    max-height: 0.75rem;
    height: 0.75rem;
    width: 0.75rem;
  }
</style>
