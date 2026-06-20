import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CalendarEventMap } from '../types';
import { WEEKDAY_LABELS, buildCalendarDays, formatDateKey } from '../utils/date';

type CalendarGridProps = {
  events: CalendarEventMap;
  month: Date;
  selectedDateKey: string;
  today: Date;
  onSelectDate: (date: Date) => void;
};

export default function CalendarGrid({
  events,
  month,
  selectedDateKey,
  today,
  onSelectDate,
}: CalendarGridProps) {
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const todayKey = formatDateKey(today);

  return (
    <View style={styles.card}>
      <View style={styles.legendRow}>
        <LegendDot color="#0f766e" label="开始" />
        <LegendDot color="#ef4444" label="截止" />
        <LegendDot color="#2563eb" label="考试" />
      </View>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.dayGrid}>
        {days.map(({ date, isCurrentMonth }) => {
          const dateKey = formatDateKey(date);
          const selected = dateKey === selectedDateKey;
          const isToday = dateKey === todayKey;
          const event = events[dateKey];

          return (
            <TouchableOpacity
              activeOpacity={0.82}
              key={dateKey}
              onPress={() => onSelectDate(date)}
              style={[
                styles.dayCell,
                selected && styles.selectedDayCell,
                !isCurrentMonth && styles.outsideMonthCell,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  !isCurrentMonth && styles.outsideMonthText,
                  isToday && styles.todayText,
                  selected && styles.selectedDayText,
                ]}
              >
                {date.getDate()}
              </Text>
              <View style={styles.dotRow}>
                {event?.start ? <View style={[styles.dot, styles.startDot]} /> : null}
                {event?.deadline ? <View style={[styles.dot, styles.deadlineDot]} /> : null}
                {event?.exam ? <View style={[styles.dot, styles.examDot]} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e5e8',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  legendDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  legendText: {
    color: '#627680',
    fontSize: 12,
    fontWeight: '800',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekLabel: {
    color: '#7a8d96',
    flex: 1,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  selectedDayCell: {
    backgroundColor: '#102027',
  },
  outsideMonthCell: {
    opacity: 0.48,
  },
  dayText: {
    color: '#22343b',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  outsideMonthText: {
    color: '#9aabb3',
  },
  todayText: {
    color: '#0f766e',
    fontWeight: '900',
  },
  selectedDayText: {
    color: '#ffffff',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 7,
    marginTop: 4,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  startDot: {
    backgroundColor: '#0f766e',
  },
  deadlineDot: {
    backgroundColor: '#ef4444',
  },
  examDot: {
    backgroundColor: '#2563eb',
  },
});
