export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()}年 ${date.getMonth() + 1}月`;
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function buildCalendarDays(month: Date): CalendarDay[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const startOffset = firstDay.getDay();
  const startDate = new Date(year, monthIndex, 1 - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + index
    );

    return {
      date,
      isCurrentMonth: date.getMonth() === monthIndex,
    };
  });
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dayDifference(fromDate: Date, toDateKey: string): number {
  const from = startOfDay(fromDate).getTime();
  const to = parseDateKey(toDateKey).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.round((to - from) / dayMs);
}
