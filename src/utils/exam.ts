import {
  CertificateType,
  CalendarEventMap,
  ExamItem,
  ExamStatus,
  RadarInfo,
  RegionFilter,
} from '../types';
import { dayDifference, formatDateKey } from './date';

export const CERTIFICATE_TYPES: CertificateType[] = [
  '初级教练员证',
  '二级裁判员证',
  '乒乓球二级裁判员证',
];

export const REGION_OPTIONS: RegionFilter[] = ['山西', '江西', '全国'];

export function getExamStatus(item: ExamItem, today = new Date()): ExamStatus {
  const radar = getRadarInfo(item, today);
  if (radar.radarStatus === '历史通知') {
    return '已截止';
  }

  return radar.radarStatus;
}

export function getRadarInfo(item: Partial<ExamItem>, today = new Date()): RadarInfo {
  const title = item.title ?? '';
  const verified = Boolean(item.verified);
  const sourceUrl = item.sourceUrl ?? '';
  const hasRequiredTiming = Boolean(
    item.registrationStartDate && item.registrationEndDate && item.examDate && item.location
  );
  const isHistorical = detectHistoricalTitle(title, today);
  const daysUntilStart = item.registrationStartDate
    ? dayDifference(today, item.registrationStartDate)
    : null;
  const daysUntilDeadline = item.registrationEndDate
    ? dayDifference(today, item.registrationEndDate)
    : null;
  const hasValidDateWindow =
    typeof daysUntilStart === 'number' &&
    typeof daysUntilDeadline === 'number' &&
    !Number.isNaN(daysUntilStart) &&
    !Number.isNaN(daysUntilDeadline);

  if (isHistorical) {
    return {
      radarStatus: '历史通知',
      priority: 'low',
      daysUntilDeadline: normalizeDayValue(daysUntilDeadline),
      daysUntilStart: normalizeDayValue(daysUntilStart),
      isHistorical: true,
      canApply: false,
      actionLabel: sourceUrl ? '历史参考 / 查看来源' : '暂无官方链接',
      statusLabel: '历史参考，不可报名',
      statusColorType: 'history',
      notifyReason: '标题包含早于当前年份的年份，仅作历史参考。',
    };
  }

  if (item.status === '待核验' || !item.registrationEndDate || !item.registrationStartDate) {
    return {
      radarStatus: '待核验',
      priority: 'medium',
      daysUntilDeadline: normalizeDayValue(daysUntilDeadline),
      daysUntilStart: normalizeDayValue(daysUntilStart),
      isHistorical: false,
      canApply: false,
      actionLabel: sourceUrl ? '查看来源' : '暂无官方链接',
      statusLabel: '待人工核验',
      statusColorType: 'pending',
      notifyReason: '缺少明确报名开始/截止时间，需要人工核验。',
    };
  }

  if (!verified || !hasRequiredTiming || !hasValidDateWindow) {
    return {
      radarStatus: '待核验',
      priority: 'medium',
      daysUntilDeadline: normalizeDayValue(daysUntilDeadline),
      daysUntilStart: normalizeDayValue(daysUntilStart),
      isHistorical: false,
      canApply: false,
      actionLabel: sourceUrl ? '查看来源' : '暂无官方链接',
      statusLabel: '待人工核验',
      statusColorType: 'pending',
      notifyReason: '未核验或缺少报名时间、考试时间、地点等关键字段。',
    };
  }

  if (daysUntilDeadline < 0) {
    return {
      radarStatus: '已截止',
      priority: 'low',
      daysUntilDeadline,
      daysUntilStart,
      isHistorical: false,
      canApply: false,
      actionLabel: sourceUrl ? '历史参考 / 查看来源' : '暂无官方链接',
      statusLabel: '已截止',
      statusColorType: 'closed',
      notifyReason: '报名截止时间已过，不可报名。',
    };
  }

  if (daysUntilStart > 0) {
    const startsSoon = daysUntilStart <= 7;
    return {
      radarStatus: '未开始',
      priority: startsSoon ? 'medium' : 'low',
      daysUntilDeadline,
      daysUntilStart,
      isHistorical: false,
      canApply: false,
      actionLabel: sourceUrl ? '查看官方通知' : '暂无官方链接',
      statusLabel: startsSoon ? `距报名开始 ${daysUntilStart} 天` : '报名未开始',
      statusColorType: 'future',
      notifyReason: startsSoon ? `报名将在 ${daysUntilStart} 天后开始。` : '报名尚未开始。',
    };
  }

  const canApply = verified && isRealSourceUrl(sourceUrl);
  if (daysUntilDeadline <= 7) {
    return {
      radarStatus: '即将截止',
      priority: 'high',
      daysUntilDeadline,
      daysUntilStart,
      isHistorical: false,
      canApply,
      actionLabel: canApply ? '查看官方通知 / 去报名' : '查看来源',
      statusLabel: `距截止 ${daysUntilDeadline} 天`,
      statusColorType: 'hot',
      notifyReason: `报名将在 ${daysUntilDeadline} 天内截止，请优先处理。`,
    };
  }

  return {
    radarStatus: '报名中',
    priority: 'high',
    daysUntilDeadline,
    daysUntilStart,
    isHistorical: false,
    canApply,
    actionLabel: canApply ? '查看官方通知 / 去报名' : '查看来源',
    statusLabel: '报名中',
    statusColorType: 'active',
    notifyReason: '当前处于报名时间窗口内。',
  };
}

export function isExamInRegion(item: ExamItem, region: RegionFilter): boolean {
  if (region === '全国') {
    return true;
  }

  return item.province === region;
}

export function sortByDeadline(items: ExamItem[]): ExamItem[] {
  return [...items].sort(
    (first, second) => getDateTime(first.registrationEndDate) - getDateTime(second.registrationEndDate)
  );
}

export function getImportantItems(items: ExamItem[], today = new Date()) {
  const openCandidates = sortByDeadline(items.filter((item) => item.status !== '已截止'));

  return {
    closingSoon: openCandidates.filter((item) => {
      if (item.status === '待核验') {
        return false;
      }
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
      if (item.status === '待核验') {
        return [];
      }

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

    if (startKey) {
      events[startKey] = events[startKey] ?? { deadline: 0, exam: 0, start: 0 };
      events[startKey].start += 1;
    }
    if (deadlineKey) {
      events[deadlineKey] = events[deadlineKey] ?? { deadline: 0, exam: 0, start: 0 };
      events[deadlineKey].deadline += 1;
    }
    if (examKey && /^\d{4}-\d{2}-\d{2}$/.test(examKey)) {
      events[examKey] = events[examKey] ?? { deadline: 0, exam: 0, start: 0 };
      events[examKey].exam += 1;
    }

    return events;
  }, {});
}

export function getRelativeDeadlineText(item: ExamItem, today = new Date()): string {
  const radar = getRadarInfo(item, today);
  if (radar.isHistorical) {
    return '历史参考，不可报名';
  }
  if (radar.radarStatus === '待核验') {
    return '报名时间待核验';
  }
  if (radar.daysUntilStart !== null && radar.daysUntilStart > 0) {
    return `距离报名开始 ${radar.daysUntilStart} 天`;
  }
  if (radar.daysUntilDeadline !== null && radar.daysUntilDeadline >= 0) {
    return radar.daysUntilDeadline === 0 ? '今天截止' : `距截止 ${radar.daysUntilDeadline} 天`;
  }

  if (item.status === '待核验' || !item.registrationEndDate) {
    return '报名时间待核验';
  }

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
  return getRadarInfo(item).canApply && item.dataSourceType === 'official';
}

export function canOpenSourcePage(item: ExamItem): boolean {
  return item.dataSourceType === 'official' && isRealSourceUrl(item.sourceUrl);
}

export function getPriorityRank(priority: RadarInfo['priority']): number {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function detectHistoricalTitle(title: string, today: Date): boolean {
  const currentYear = today.getFullYear();
  const years = title.match(/20\d{2}/g) ?? [];
  return years.some((year) => Number(year) < currentYear);
}

function normalizeDayValue(value: number | null): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function getDateTime(dateKey: string): number {
  if (!dateKey) {
    return Number.MAX_SAFE_INTEGER;
  }

  const time = new Date(dateKey).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}
