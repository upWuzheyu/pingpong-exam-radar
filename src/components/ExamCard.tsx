import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ExamItem, RadarInfo } from '../types';
import { canOpenSourcePage, getRadarInfo, getRelativeDeadlineText } from '../utils/exam';

type ExamCardProps = {
  compact?: boolean;
  detailed?: boolean;
  item: ExamItem;
  onOpen: (item: ExamItem) => void;
  onPress?: (item: ExamItem) => void;
};

export default function ExamCard({ compact, detailed, item, onOpen, onPress }: ExamCardProps) {
  const radar = getRadarInfo(item);
  const ended = radar.radarStatus === '已截止' || radar.isHistorical;
  const canGoRegister = radar.canApply;
  const canOpenSource = canOpenSourcePage(item);
  const category = item.category || (item.certificateType.includes('裁判') ? '裁判员' : '教练员');
  const level = item.level || (category === '裁判员' ? '裁判员（未分级）' : '教练员（未分级）');

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.86 : 1}
      disabled={!onPress}
      onPress={() => onPress?.(item)}
      style={[styles.card, ended && styles.cardEnded]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, ended && styles.endedText]}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.province}{item.city} · {item.certificateType}
          </Text>
        </View>
        <StatusPill radar={radar} />
      </View>

      <View style={styles.dateRow}>
        <DateBlock
          label="报名"
          value={
            item.registrationStartDate && item.registrationEndDate
              ? `${item.registrationStartDate} 至 ${item.registrationEndDate}`
              : '待核验'
          }
        />
        {!compact ? <DateBlock label="考试" value={item.examDate || '待核验'} /> : null}
      </View>

      <Text style={[styles.deadlineText, item.status === '即将截止' && styles.deadlineHot]}>
        {getRelativeDeadlineText(item)}
      </Text>

      <View style={styles.noticeStack}>
        {canGoRegister ? (
          <Text style={styles.officialNotice}>真实官方通知</Text>
        ) : null}
        <Text style={styles.categoryNotice}>{category} · {level}</Text>
        {item.isMock ? (
          <Text style={styles.mockNotice}>示例数据，非真实报名通知</Text>
        ) : null}
        {!item.verified ? (
          <Text style={styles.unverifiedNotice}>待人工核验，请以官方通知为准</Text>
        ) : null}
      </View>

      {detailed ? (
        <View style={styles.detailBody}>
          <DetailLine label="发布单位" value={item.organization} />
          <DetailLine label="类别" value={`${category} · ${level}`} />
          <DetailLine label="命中原因" value={item.matchReason || radar.notifyReason} />
          <DetailLine label="考试地点" value={item.location || '待核验'} />
          <DetailLine label="状态" value={`${radar.statusLabel}｜${radar.notifyReason}`} />
          <DetailLine label="数据类型" value={getDataSourceLabel(item.dataSourceType)} />
          <DetailLine label="来源链接" value={item.sourceUrl || '暂无官方链接'} />
          <DetailLine label="链接状态" value={radar.actionLabel} />
          <DetailLine label="最后检查" value={new Date(item.lastCheckedAt).toLocaleString()} />
          <DetailLine label="备注" value={item.note} />
        </View>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.84}
        onPress={() => onOpen(item)}
        style={[styles.linkButton, !canOpenSource && styles.linkButtonDisabled]}
      >
        <Text style={[styles.linkButtonText, !canOpenSource && styles.linkButtonTextDisabled]}>
          {radar.actionLabel}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function getDataSourceLabel(dataSourceType: ExamItem['dataSourceType']): string {
  if (dataSourceType === 'official') {
    return '官方来源';
  }
  if (dataSourceType === 'manual') {
    return '手动录入';
  }
  return '示例数据';
}

function StatusPill({ radar }: { radar: RadarInfo }) {
  return (
    <View style={[styles.statusPill, statusStyles[radar.statusColorType]]}>
      <Text style={[styles.statusText, statusTextStyles[radar.statusColorType]]}>
        {radar.radarStatus}
      </Text>
    </View>
  );
}

function DateBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dateBlock}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{value}</Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const statusStyles = StyleSheet.create({
  future: {
    backgroundColor: '#eef6ff',
  },
  active: {
    backgroundColor: '#dcfce7',
  },
  hot: {
    backgroundColor: '#ffedd5',
  },
  closed: {
    backgroundColor: '#e5e7eb',
  },
  pending: {
    backgroundColor: '#fef3c7',
  },
  history: {
    backgroundColor: '#e5e7eb',
  },
});

const statusTextStyles = StyleSheet.create({
  future: {
    color: '#2563eb',
  },
  active: {
    color: '#15803d',
  },
  hot: {
    color: '#c2410c',
  },
  closed: {
    color: '#6b7280',
  },
  pending: {
    color: '#92400e',
  },
  history: {
    color: '#6b7280',
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  cardEnded: {
    backgroundColor: 'rgba(30, 41, 59, 0.72)',
    opacity: 0.78,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: '#f8fbff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 5,
  },
  endedText: {
    color: '#94a3b8',
  },
  meta: {
    color: '#9bb4d5',
    fontSize: 13,
    fontWeight: '800',
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  dateRow: {
    gap: 8,
    marginBottom: 8,
  },
  dateBlock: {
    backgroundColor: 'rgba(17, 26, 51, 0.92)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateLabel: {
    color: '#79e8ff',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  dateValue: {
    color: '#dbe8ff',
    fontSize: 13,
    fontWeight: '800',
  },
  deadlineText: {
    color: '#79e8ff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  deadlineHot: {
    color: '#dc2626',
  },
  noticeStack: {
    gap: 6,
    marginBottom: 10,
  },
  mockNotice: {
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    color: '#c2410c',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  officialNotice: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    color: '#15803d',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  categoryNotice: {
    backgroundColor: '#e0e7ff',
    borderRadius: 8,
    color: '#4338ca',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unverifiedNotice: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  detailBody: {
    borderTopColor: '#263f6c',
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
  },
  detailLine: {
    marginBottom: 9,
  },
  detailLabel: {
    color: '#79e8ff',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  detailValue: {
    color: '#dbe8ff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  linkButton: {
    alignItems: 'center',
    backgroundColor: '#2f6bff',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
  },
  linkButtonDisabled: {
    backgroundColor: '#1f2937',
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  linkButtonTextDisabled: {
    color: '#94a3b8',
  },
});
