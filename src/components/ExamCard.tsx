import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ExamItem, ExamStatus } from '../types';
import { canOpenOfficialSource, canOpenSourcePage, getRelativeDeadlineText } from '../utils/exam';

type ExamCardProps = {
  compact?: boolean;
  detailed?: boolean;
  item: ExamItem;
  onOpen: (item: ExamItem) => void;
  onPress?: (item: ExamItem) => void;
};

export default function ExamCard({ compact, detailed, item, onOpen, onPress }: ExamCardProps) {
  const ended = item.status === '已截止';
  const canGoRegister = canOpenOfficialSource(item);
  const canOpenSource = canOpenSourcePage(item);

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
        <StatusPill status={item.status} />
      </View>

      <View style={styles.dateRow}>
        <DateBlock label="报名" value={`${item.registrationStartDate} 至 ${item.registrationEndDate}`} />
        {!compact ? <DateBlock label="考试" value={item.examDate} /> : null}
      </View>

      <Text style={[styles.deadlineText, item.status === '即将截止' && styles.deadlineHot]}>
        {getRelativeDeadlineText(item)}
      </Text>

      <View style={styles.noticeStack}>
        {canGoRegister ? (
          <Text style={styles.officialNotice}>真实官方通知</Text>
        ) : null}
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
          <DetailLine label="类别" value={`${item.category} · ${item.level}`} />
          <DetailLine label="命中原因" value={item.matchReason || '人工录入或历史数据'} />
          <DetailLine label="考试地点" value={item.location} />
          <DetailLine label="数据类型" value={getDataSourceLabel(item.dataSourceType)} />
          <DetailLine label="来源链接" value={item.sourceUrl || '暂无官方链接'} />
          <DetailLine label="链接状态" value={canGoRegister ? '查看官方通知' : canOpenSource ? '查看来源' : '暂无官方链接'} />
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
          {canGoRegister ? '查看官方通知 / 去报名' : canOpenSource ? '查看来源' : '暂无官方链接'}
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

function StatusPill({ status }: { status: ExamStatus }) {
  return (
    <View style={[styles.statusPill, statusStyles[status]]}>
      <Text style={[styles.statusText, statusTextStyles[status]]}>{status}</Text>
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
  未开始: {
    backgroundColor: '#eef6ff',
  },
  报名中: {
    backgroundColor: '#dcfce7',
  },
  即将截止: {
    backgroundColor: '#ffedd5',
  },
  已截止: {
    backgroundColor: '#e5e7eb',
  },
  待核验: {
    backgroundColor: '#fef3c7',
  },
});

const statusTextStyles = StyleSheet.create({
  未开始: {
    color: '#2563eb',
  },
  报名中: {
    color: '#15803d',
  },
  即将截止: {
    color: '#c2410c',
  },
  已截止: {
    color: '#6b7280',
  },
  待核验: {
    color: '#92400e',
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e5e8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  cardEnded: {
    backgroundColor: '#f3f4f6',
    opacity: 0.72,
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
    color: '#102027',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 5,
  },
  endedText: {
    color: '#6b7280',
  },
  meta: {
    color: '#667985',
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
    backgroundColor: '#f6fafb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dateLabel: {
    color: '#768994',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  dateValue: {
    color: '#21343c',
    fontSize: 13,
    fontWeight: '800',
  },
  deadlineText: {
    color: '#0f766e',
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
    borderTopColor: '#e3ecef',
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 10,
  },
  detailLine: {
    marginBottom: 9,
  },
  detailLabel: {
    color: '#768994',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 3,
  },
  detailValue: {
    color: '#21343c',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  linkButton: {
    alignItems: 'center',
    backgroundColor: '#102027',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
  },
  linkButtonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  linkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  linkButtonTextDisabled: {
    color: '#6b7280',
  },
});
