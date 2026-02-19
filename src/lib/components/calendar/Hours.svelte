<script lang="ts">
  import type { HistoryByDayAndHour } from "../../utils/chrome-api";
  import type { Attachment } from "svelte/attachments";
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

  type HourRow = {
    hour: number;
    hourLabel: string;
    cells: {
      date: string;
      level: number;
      count: number;
      key: string;
    }[];
  };

  type CalendarData = {
    days: { date: string; dayName: string; dayNum: number; month: string }[];
    hours: HourRow[];
    months: { name: string; span: number }[];
  };

  function organizeCalendarData(
    historyByDayAndHour: HistoryByDayAndHour,
  ): CalendarData {
    const sortedDates = Object.keys(historyByDayAndHour).sort();
    if (sortedDates.length === 0) {
      return { days: [], hours: [], months: [] };
    }

    // Generate day headers
    const days = sortedDates.map((dateKey) => {
      const date = new Date(dateKey);
      return {
        date: dateKey,
        dayName: date.toLocaleDateString(undefined, { weekday: "narrow" }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString(undefined, { month: "short" }),
      };
    });

    // Calculate month headers with colspan
    const months: { name: string; span: number }[] = [];
    let currentMonth = "";
    let monthSpan = 0;

    for (const day of days) {
      if (day.month !== currentMonth) {
        if (currentMonth) {
          months.push({ name: currentMonth, span: monthSpan });
        }
        currentMonth = day.month;
        monthSpan = 1;
      } else {
        monthSpan++;
      }
    }
    if (currentMonth) {
      months.push({ name: currentMonth, span: monthSpan });
    }

    // Find max count for level calculation
    let maxCount = 0;
    for (const day of Object.values(historyByDayAndHour)) {
      for (const items of Object.values(day)) {
        maxCount = Math.max(maxCount, items.length);
      }
    }

    // Generate 24 hour rows
    const hours: HourRow[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      cells: sortedDates.map((dateKey) => {
        const hourKey = String(hour).padStart(2, "0");
        const count = historyByDayAndHour[dateKey]?.[hourKey]?.length ?? 0;
        const level =
          maxCount === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
        return {
          date: dateKey,
          level,
          count,
          key: getHourKey(dateKey, hour),
        };
      }),
    }));

    return { days, hours, months };
  }

  const calendarData = $derived(organizeCalendarData(data));

  const scrollRight: Attachment = (element) => {
    element.scrollLeft = element.scrollWidth;
  };
</script>

{#if calendarData.days.length === 0}
  <p>No history data available to display the calendar.</p>
{:else}
  <div class="calendar" {@attach scrollRight}>
    <table>
      <thead>
        <tr class="months">
          <th></th>
          {#each calendarData.months as month}
            <th colspan={month.span}>{month.name}</th>
          {/each}
        </tr>
        <tr class="days">
          <th></th>
          {#each calendarData.days as day}
            <th title={day.date}>{day.dayNum}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each calendarData.hours as row}
          <tr>
            <th>{row.hourLabel}</th>
            {#each row.cells as cell}
              <td
                tabindex={cell.count > 0 || selectedMoments.includes(cell.key)
                  ? 0
                  : -1}
                data-level={cell.level}
                data-selected={selectedMoments.includes(cell.key)}
                title="{cell.date} {row.hourLabel}: {cell.count} visits"
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
  }
</style>
