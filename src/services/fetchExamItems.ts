import { REMOTE_FEED_URL } from '../config/feedConfig';
import { localExamItems } from '../data/examItems';
import { ExamItem } from '../types';

export type ExamFeedStatus = 'loading' | 'remote' | 'local' | 'fallback';

export type ExamFeedResult = {
  items: ExamItem[];
  lastUpdatedAt: string;
  message: string;
  status: Exclude<ExamFeedStatus, 'loading'>;
};

const REQUIRED_FIELDS: Array<keyof ExamItem> = [
  'id',
  'title',
  'certificateType',
  'province',
  'city',
  'organization',
  'registrationStartDate',
  'registrationEndDate',
  'examDate',
  'location',
  'sourceUrl',
  'status',
  'isMock',
  'verified',
  'dataSourceType',
  'lastCheckedAt',
  'note',
  'category',
  'level',
  'matchReason',
];

export async function fetchExamItemsFromFeed(): Promise<ExamFeedResult> {
  const now = new Date().toISOString();
  const feedUrl = REMOTE_FEED_URL.trim();

  if (!feedUrl) {
    return {
      items: localExamItems,
      lastUpdatedAt: now,
      message: '已使用本地数据（未配置远程地址）',
      status: 'local',
    };
  }

  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`Remote feed returned ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || !data.every(isValidExamItem)) {
      throw new Error('Remote feed format is invalid');
    }

    return {
      items: data,
      lastUpdatedAt: now,
      message: '已使用远程数据',
      status: 'remote',
    };
  } catch {
    return {
      items: localExamItems,
      lastUpdatedAt: now,
      message: '远程读取失败，已使用本地数据',
      status: 'fallback',
    };
  }
}

function isValidExamItem(value: unknown): value is ExamItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<ExamItem>;
  return REQUIRED_FIELDS.every((field) => field in item);
}
