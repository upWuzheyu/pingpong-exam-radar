import { CertificateType, CalendarEventMap, ExamItem, ExamStatus, RegionFilter } from '../types';
import { dayDifference, formatDateKey } from './date';

export const CERTIFICATE_TYPES: CertificateType[] = [
  '初级教练员证',
  '二级裁判员证',
  '乒乓球二级裁判员证',
];

export const REGION_OPTIONS: RegionFilter[] = ['山西', '江西', '全国'];

export function getExamStatus(item: ExamItem, today = new Date()): ExamStatus {
  const startDiff = dayDifference(today, item.registrationStartDate);
  const endDiff = dayDifference(today, item.registrationEndDate);

  if (endDiff < 0) {
    return '已截止';
  }

  if (startDiff > 0) {
    return '未开始';
  }

  if (endDiff <= 3) {
    return '即将截止';
  }

  return '报名中';
}

export function isExamInRegion(item: ExamItem, region: RegionFilter): boolean {
  if (region === '全国') {
    return true;
  }

  return item.province === region;
}

export function sortByDeadline(items: ExamItem[]): ExamItem[] {
  return [...items].sort(
    (first, second) =>
      new Date(first.registrationEndDate).getTime() -
      new Date(second.registrationEndDate).getTime()
  );
}

export function getImportantItems(items: ExamItem[], today = new Date()) {
  const openCandidates = sortByDeadline(items.filter((item) => item.status !== '已截止'));

  return {
    closingSoon: openCandidates.filter((item) => {
      const days = dayDifference(today, item.registrationEndDate);
      return days >= 0 && days <= 7;
    }),
    openNow: openCandidates.filter((item) => item.status === '报名中' || item.status === '即将截止'),
    recentlyFound: [...items].sort(
      (first, second) =>
        new Date(second.lastCheckedAt).getTime() - new Date(first.lastCheckedAt).getTime()
    ),
  };
}

export function buildReminderMessages(items: ExamItem[], today = new Date()) {
  return items
    .flatMap((item) => {
      const startDiff = dayDifference(today, item.registrationStartDate);
      const endDiff = dayDifference(today, item.registrationEndDate);
      const messages: { item: ExamItem; message: string; level: 'warning' | 'critical' }[] = [];

      if (startDiff === 7) {
        messages.push({ item, message: '距离报名开始还有 7 天', level: 'warning' });
      }
      if (startDiff === 0) {
        messages.push({ item, message: '今天开始报名', level: 'warning' });
      }
      if (endDiff === 7) {
        messages.push({ item, message: '距离报名截止还有 7 天', level: 'warning' });
      }
      if (endDiff === 3) {
        messages.push({ item, message: '距离报名截止还有 3 天', level: 'warning' });
      }
      if (endDiff === 1) {
        messages.push({ item, message: '明天报名截止', level: 'critical' });
      }
      if (endDiff === 0) {
        messages.push({ item, message: '今天报名截止，请优先处理', level: 'critical' });
      }

      return messages;
    })
    .sort((first, second) => {
      if (first.level === second.level) {
        return 0;
      }
      return first.level === 'critical' ? -1 : 1;
    });
}

export function buildCalendarEvents(items: ExamItem[]): CalendarEventMap {
  return items.reduce<CalendarEventMap>((events, item) => {
    const startKey = item.registrationStartDate;
    const deadlineKey = item.registrationEndDate;
    const examKey = item.examDate;

    events[startKey] = events[startKey] ?? { deadline: 0, exam: 0, start: 0 };
    events[startKey].start += 1;
    events[deadlineKey] = events[deadlineKey] ?? { deadline: 0, exam: 0, start: 0 };
    events[deadlineKey].deadline += 1;
    events[examKey] = events[examKey] ?? { deadline: 0, exam: 0, start: 0 };
    events[examKey].exam += 1;

    return events;
  }, {});
}

export function getRelativeDeadlineText(item: ExamItem, today = new Date()): string {
  const days = dayDifference(today, item.registrationEndDate);

  if (days < 0) {
    return '报名已截止';
  }
  if (days === 0) {
    return '今天截止';
  }
  if (days === 1) {
    return '明天截止';
  }

  return `${days} 天后截止`;
}

export function getDateLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return formatDateKey(date);
}

export function isRealSourceUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  const normalized = url.trim().toLowerCase();
  if (!normalized.startsWith('https://') && !normalized.startsWith('http://')) {
    return false;
  }

  try {
    const hostname = new URL(normalized).hostname;
    const placeholderNames = ['example', 'test', 'demo'];
    return !placeholderNames.some(
      (name) => hostname === `${name}.com` || hostname === `www.${name}.com`
    );
  } catch {
    return false;
  }
}

export function canOpenOfficialSource(item: ExamItem): boolean {
  return item.dataSourceType === 'official' && item.verified && isRealSourceUrl(item.sourceUrl);
}
