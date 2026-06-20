import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import CalendarGrid from './src/components/CalendarGrid';
import ExamCard from './src/components/ExamCard';
import { localExamItems } from './src/data/examItems';
import {
  ExamFeedStatus,
  fetchExamItemsFromFeed,
} from './src/services/fetchExamItems';
import {
  CertificateType,
  ExamItem,
  ExamStatus,
  RegionFilter,
  Settings,
  TimeFilter,
} from './src/types';
import { addMonths, formatDateKey, formatMonthTitle } from './src/utils/date';
import {
  CERTIFICATE_TYPES,
  REGION_OPTIONS,
  buildCalendarEvents,
  buildReminderMessages,
  canOpenOfficialSource,
  canOpenSourcePage,
  getExamStatus,
  getImportantItems,
  getPriorityRank,
  getRadarInfo,
  isExamInRegion,
  sortByDeadline,
} from './src/utils/exam';

type TabKey = 'home' | 'opportunities' | 'focus' | 'calendar' | 'add' | 'settings';

type ManualForm = {
  title: string;
  certificateType: CertificateType;
  province: string;
  city: string;
  registrationStartDate: string;
  registrationEndDate: string;
  examDate: string;
  sourceUrl: string;
  note: string;
};

const STATUS_OPTIONS: ExamStatus[] = ['报名中', '即将截止', '未开始', '已截止', '待核验'];
const TIME_OPTIONS: TimeFilter[] = ['全部', '最近7天', '最近30天'];

const initialSettings: Settings = {
  certificateTypes: ['初级教练员证', '二级裁判员证'],
  regions: ['山西', '江西', '全国'],
  lastUpdatedAt: new Date().toISOString(),
};

const emptyForm: ManualForm = {
  title: '',
  certificateType: '初级教练员证',
  province: '',
  city: '',
  registrationStartDate: '',
  registrationEndDate: '',
  examDate: '',
  sourceUrl: '',
  note: '',
};

export default function App() {
  const today = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [items, setItems] = useState<ExamItem[]>(localExamItems);
  const [feedStatus, setFeedStatus] = useState<ExamFeedStatus>('loading');
  const [feedMessage, setFeedMessage] = useState('正在读取远程数据');
  const [selectedItem, setSelectedItem] = useState<ExamItem | null>(null);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [certificateFilter, setCertificateFilter] = useState<CertificateType | '全部'>('全部');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('全国');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | '全部'>('全部');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('全部');
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(today));
  const [form, setForm] = useState<ManualForm>(emptyForm);

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      setFeedStatus('loading');
      setFeedMessage('正在读取远程数据');
      const result = await fetchExamItemsFromFeed();

      if (!active) {
        return;
      }

      setItems(result.items);
      setFeedStatus(result.status);
      setFeedMessage(result.message);
      setSettings((current) => ({ ...current, lastUpdatedAt: result.lastUpdatedAt }));
    };

    loadFeed();

    return () => {
      active = false;
    };
  }, []);

  const enrichedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        status: getExamStatus(item, today),
      })),
    [items, today]
  );
  const radarItems = useMemo(
    () =>
      enrichedItems
        .map((item) => ({ item, radar: getRadarInfo(item, today) }))
        .sort((first, second) => {
          const priorityDiff =
            getPriorityRank(first.radar.priority) - getPriorityRank(second.radar.priority);
          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          return (
            (first.radar.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER) -
            (second.radar.daysUntilDeadline ?? Number.MAX_SAFE_INTEGER)
          );
        }),
    [enrichedItems, today]
  );
  const radarStats = useMemo(
    () => ({
      total: radarItems.length,
      pending: radarItems.filter(({ radar }) => radar.radarStatus === '待核验').length,
      canApply: radarItems.filter(({ radar }) => radar.canApply).length,
      closingSoon: radarItems.filter(({ radar }) => radar.radarStatus === '即将截止').length,
      historical: radarItems.filter(({ radar }) => radar.isHistorical || radar.radarStatus === '已截止')
        .length,
    }),
    [radarItems]
  );
  const highPriorityItems = useMemo(
    () => radarItems.filter(({ radar }) => radar.priority === 'high').map(({ item }) => item),
    [radarItems]
  );
  const sortedRadarList = useMemo(() => radarItems.map(({ item }) => item), [radarItems]);

  const important = useMemo(() => getImportantItems(enrichedItems, today), [enrichedItems, today]);
  const reminders = useMemo(() => buildReminderMessages(enrichedItems, today), [enrichedItems, today]);
  const calendarEvents = useMemo(() => buildCalendarEvents(enrichedItems), [enrichedItems]);
  const calendarDayItems = useMemo(
    () =>
      enrichedItems.filter(
        (item) =>
          item.registrationEndDate === selectedDateKey ||
          item.examDate === selectedDateKey ||
          item.registrationStartDate === selectedDateKey
      ),
    [enrichedItems, selectedDateKey]
  );

  const filteredItems = useMemo(() => {
    const maxDate = new Date(today);
    if (timeFilter === '最近7天') {
      maxDate.setDate(maxDate.getDate() + 7);
    }
    if (timeFilter === '最近30天') {
      maxDate.setDate(maxDate.getDate() + 30);
    }

    return sortByDeadline(
      enrichedItems.filter((item) => {
        const matchesCertificate =
          certificateFilter === '全部' || item.certificateType === certificateFilter;
        const matchesRegion = regionFilter === '全国' || isExamInRegion(item, regionFilter);
        const matchesStatus = statusFilter === '全部' || item.status === statusFilter;
        const matchesTime =
          timeFilter === '全部' ||
          new Date(item.registrationEndDate).getTime() <= maxDate.getTime();

        return matchesCertificate && matchesRegion && matchesStatus && matchesTime;
      })
    );
  }, [certificateFilter, enrichedItems, regionFilter, statusFilter, timeFilter, today]);

  const focusedItems = useMemo(
    () =>
      sortByDeadline(
        enrichedItems.filter(
          (item) =>
            settings.certificateTypes.includes(item.certificateType) &&
            settings.regions.some((region) => isExamInRegion(item, region))
        )
      ),
    [enrichedItems, settings]
  );

  const openSource = async (item: ExamItem) => {
    const sourceUrl = item.sourceUrl.trim();

    if (!canOpenSourcePage(item)) {
      Alert.alert(
        '暂无官方链接',
        '暂无真实报名链接，请以官方体育局/乒协/学校通知为准，后续可手动补充链接。'
      );
      return;
    }

    const supported = await Linking.canOpenURL(sourceUrl);
    if (supported) {
      await Linking.openURL(sourceUrl);
      return;
    }

    Alert.alert('无法打开链接', sourceUrl);
  };

  const addManualItem = () => {
    const requiredFields = [
      form.title,
      form.province,
      form.city,
      form.registrationStartDate,
      form.registrationEndDate,
      form.examDate,
    ];

    if (requiredFields.some((value) => !value.trim())) {
      Alert.alert('请补全信息', '标题、地区和三个日期都需要填写。');
      return;
    }

    const sourceUrl = form.sourceUrl.trim();
    if (sourceUrl && !sourceUrl.startsWith('https://') && !sourceUrl.startsWith('http://')) {
      Alert.alert('报名链接格式不完整', '如果填写报名链接，请补全 http:// 或 https:// 开头。');
      return;
    }

    const item: ExamItem = {
      id: `manual-${Date.now()}`,
      title: form.title.trim(),
      certificateType: form.certificateType,
      province: form.province.trim(),
      city: form.city.trim(),
      organization: '手动录入',
      registrationStartDate: form.registrationStartDate.trim(),
      registrationEndDate: form.registrationEndDate.trim(),
      examDate: form.examDate.trim(),
      location: `${form.province.trim()} ${form.city.trim()}`,
      sourceUrl,
      status: '未开始',
      lastCheckedAt: new Date().toISOString(),
      note: form.note.trim() || '来自手动录入，请以原通知为准。',
      isMock: false,
      verified: false,
      dataSourceType: 'manual',
      category: form.certificateType.includes('裁判') ? '裁判员' : '教练员',
      level: form.certificateType.includes('裁判') ? '裁判员（未分级）' : '教练员（未分级）',
      matchReason: '手动添加：用户自行录入，需人工核验。',
    };

    setItems((current) => [item, ...current]);
    setSettings((current) => ({ ...current, lastUpdatedAt: new Date().toISOString() }));
    setForm(emptyForm);
    setActiveTab('home');
    Alert.alert('已添加', '新的报名信息已经加入报名雷达。');
  };

  const toggleCertificate = (certificate: CertificateType) => {
    setSettings((current) => {
      const exists = current.certificateTypes.includes(certificate);
      return {
        ...current,
        certificateTypes: exists
          ? current.certificateTypes.filter((item) => item !== certificate)
          : [...current.certificateTypes, certificate],
      };
    });
  };

  const toggleRegion = (region: RegionFilter) => {
    setSettings((current) => {
      const exists = current.regions.includes(region);
      return {
        ...current,
        regions: exists
          ? current.regions.filter((item) => item !== region)
          : [...current.regions, region],
      };
    });
  };

  const renderFilters = () => (
    <View style={styles.filterPanel}>
      <Text style={styles.sectionTitle}>筛选</Text>
      <ChipRow
        options={['全部', ...CERTIFICATE_TYPES]}
        value={certificateFilter}
        onChange={(value) => setCertificateFilter(value as CertificateType | '全部')}
      />
      <ChipRow
        options={REGION_OPTIONS}
        value={regionFilter}
        onChange={(value) => setRegionFilter(value as RegionFilter)}
      />
      <ChipRow
        options={['全部', ...STATUS_OPTIONS]}
        value={statusFilter}
        onChange={(value) => setStatusFilter(value as ExamStatus | '全部')}
      />
      <ChipRow
        options={TIME_OPTIONS}
        value={timeFilter}
        onChange={(value) => setTimeFilter(value as TimeFilter)}
      />
    </View>
  );

  const renderHome = () => (
    <View>
      <View style={styles.hero}>
        <View style={styles.radarOrb}>
          <Text style={styles.radarOrbText}>◉</Text>
        </View>
        <Text style={styles.heroEyebrow}>PING PONG RADAR 2.0</Text>
        <Text style={styles.heroTitle}>乒乓雷达</Text>
        <Text style={styles.heroMeta}>
          全国乒乓球裁判员 / 教练员考试机会追踪
        </Text>
        <Text style={styles.heroMeta}>
          最后更新时间：{new Date(settings.lastUpdatedAt).toLocaleString()}
        </Text>
        <Text style={styles.heroMeta}>
          数据来源：{feedMessage}
        </Text>
      </View>

      <View style={styles.dataNotice}>
        <Text style={styles.dataNoticeTitle}>数据说明</Text>
        <Text style={styles.feedStatusText}>数据来源：{feedMessage}</Text>
        <Text style={styles.dataNoticeText}>
          最后更新时间：{new Date(settings.lastUpdatedAt).toLocaleString()}
        </Text>
        <Text style={styles.dataNoticeText}>当前版本主要用于测试报名提醒功能。</Text>
        <Text style={styles.dataNoticeText}>示例数据不代表真实报名机会。</Text>
        <Text style={styles.dataNoticeText}>
          真实报名信息需要来自官方体育局、乒协、学校、培训机构通知。
        </Text>
      </View>

      <View style={styles.statGrid}>
        <StatCard label="发现机会" value={radarStats.total} accent="cyan" />
        <StatCard label="待核验" value={radarStats.pending} accent="violet" />
        <StatCard label="可报名" value={radarStats.canApply} accent="green" />
        <StatCard label="即将截止" value={radarStats.closingSoon} accent="orange" />
        <StatCard label="历史参考" value={radarStats.historical} accent="gray" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>今日重点提醒</Text>
        {highPriorityItems.length === 0 ? (
          <InfoBox title="暂无紧急报名机会" body="继续监控中，待核验线索可先查看来源。" />
        ) : (
          <ExamList
            compact
            items={highPriorityItems.slice(0, 3)}
            onPress={setSelectedItem}
            onOpen={openSource}
          />
        )}
      </View>

      <View style={styles.categoryGrid}>
        <CategoryEntry label="裁判员机会" value={radarItems.filter(({ item }) => item.category === '裁判员').length} />
        <CategoryEntry label="教练员机会" value={radarItems.filter(({ item }) => item.category === '教练员').length} />
        <CategoryEntry label="待核验" value={radarStats.pending} />
        <CategoryEntry label="历史参考" value={radarStats.historical} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>机会列表</Text>
        <ExamList
          compact
          items={sortedRadarList}
          onPress={setSelectedItem}
          onOpen={openSource}
        />
      </View>
    </View>
  );

  const renderOpportunities = () => (
    <View>
      {renderFilters()}
      <ExamList items={filteredItems} onPress={setSelectedItem} onOpen={openSource} />
    </View>
  );

  const renderFocus = () => (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>我的关注</Text>
        <Text style={styles.mutedText}>
          只显示你关注的证书和地区，适合每天快速检查报名机会。
        </Text>
      </View>
      <ExamList items={focusedItems} onPress={setSelectedItem} onOpen={openSource} />
    </View>
  );

  const renderCalendar = () => (
    <View>
      <View style={styles.monthControls}>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setVisibleMonth((month) => addMonths(month, -1))}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthControlTitle}>{formatMonthTitle(visibleMonth)}</Text>
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => setVisibleMonth((month) => addMonths(month, 1))}
          style={styles.navButton}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>
      <CalendarGrid
        events={calendarEvents}
        month={visibleMonth}
        selectedDateKey={selectedDateKey}
        today={today}
        onSelectDate={(date) => setSelectedDateKey(formatDateKey(date))}
      />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selectedDateKey} 节点</Text>
        <ExamList
          items={calendarDayItems}
          emptyText="这一天没有报名开始、截止或考试节点。"
          onPress={setSelectedItem}
          onOpen={openSource}
        />
      </View>
    </View>
  );

  const renderAdd = () => (
    <View style={styles.formPanel}>
      <Text style={styles.sectionTitle}>手动添加报名信息</Text>
      <Text style={styles.mutedText}>日期请使用 YYYY-MM-DD，例如 2026-07-15。</Text>
      <TextInput
        value={form.title}
        onChangeText={(title) => setForm((current) => ({ ...current, title }))}
        placeholder="标题"
        placeholderTextColor="#8992a3"
        style={styles.input}
      />
      <ChipRow
        options={CERTIFICATE_TYPES}
        value={form.certificateType}
        onChange={(certificateType) =>
          setForm((current) => ({ ...current, certificateType: certificateType as CertificateType }))
        }
      />
      <View style={styles.twoColumn}>
        <TextInput
          value={form.province}
          onChangeText={(province) => setForm((current) => ({ ...current, province }))}
          placeholder="省份"
          placeholderTextColor="#8992a3"
          style={[styles.input, styles.halfInput]}
        />
        <TextInput
          value={form.city}
          onChangeText={(city) => setForm((current) => ({ ...current, city }))}
          placeholder="城市"
          placeholderTextColor="#8992a3"
          style={[styles.input, styles.halfInput]}
        />
      </View>
      <TextInput
        value={form.registrationStartDate}
        onChangeText={(registrationStartDate) =>
          setForm((current) => ({ ...current, registrationStartDate }))
        }
        placeholder="报名开始日期 YYYY-MM-DD"
        placeholderTextColor="#8992a3"
        style={styles.input}
      />
      <TextInput
        value={form.registrationEndDate}
        onChangeText={(registrationEndDate) =>
          setForm((current) => ({ ...current, registrationEndDate }))
        }
        placeholder="报名截止日期 YYYY-MM-DD"
        placeholderTextColor="#8992a3"
        style={styles.input}
      />
      <TextInput
        value={form.examDate}
        onChangeText={(examDate) => setForm((current) => ({ ...current, examDate }))}
        placeholder="考试或培训日期 YYYY-MM-DD"
        placeholderTextColor="#8992a3"
        style={styles.input}
      />
      <TextInput
        value={form.sourceUrl}
        onChangeText={(sourceUrl) => setForm((current) => ({ ...current, sourceUrl }))}
        placeholder="报名通知链接"
        placeholderTextColor="#8992a3"
        autoCapitalize="none"
        style={styles.input}
      />
      <TextInput
        value={form.note}
        onChangeText={(note) => setForm((current) => ({ ...current, note }))}
        placeholder="备注"
        placeholderTextColor="#8992a3"
        multiline
        style={[styles.input, styles.noteInput]}
      />
      <TouchableOpacity activeOpacity={0.84} onPress={addManualItem} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>保存到报名雷达</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSettings = () => (
    <View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>设置</Text>
        <Text style={styles.mutedText}>
          最后更新时间：{new Date(settings.lastUpdatedAt).toLocaleString()}
        </Text>
      </View>
      <SettingsBlock
        title="关注证书"
        options={CERTIFICATE_TYPES}
        selected={settings.certificateTypes}
        onToggle={(value) => toggleCertificate(value as CertificateType)}
      />
      <SettingsBlock
        title="关注地区"
        options={REGION_OPTIONS}
        selected={settings.regions}
        onToggle={(value) => toggleRegion(value as RegionFilter)}
      />
      <TouchableOpacity
        activeOpacity={0.84}
        onPress={async () => {
          setFeedStatus('loading');
          setFeedMessage('正在读取远程数据');
          const result = await fetchExamItemsFromFeed();

          setItems(result.items);
          setFeedStatus(result.status);
          setFeedMessage(result.message);
          setSettings((current) => ({ ...current, lastUpdatedAt: result.lastUpdatedAt }));
          Alert.alert('已刷新', result.message);
        }}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>手动刷新数据源</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#eef5f7" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.appLabel}>训练专业 · 考证助手</Text>
              <Text style={styles.appTitle}>报名雷达</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => setActiveTab('add')}
              style={styles.quickAddButton}
            >
              <Text style={styles.quickAddText}>+ 录入</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
            <TabButton active={activeTab === 'home'} label="首页" onPress={() => setActiveTab('home')} />
            <TabButton
              active={activeTab === 'opportunities'}
              label="机会"
              onPress={() => setActiveTab('opportunities')}
            />
            <TabButton
              active={activeTab === 'focus'}
              label="我的"
              onPress={() => setActiveTab('focus')}
            />
            <TabButton
              active={activeTab === 'calendar'}
              label="提醒"
              onPress={() => setActiveTab('calendar')}
            />
            <TabButton
              active={activeTab === 'settings'}
              label="设置"
              onPress={() => setActiveTab('settings')}
            />
          </ScrollView>

          {activeTab === 'home' && renderHome()}
          {activeTab === 'opportunities' && renderOpportunities()}
          {activeTab === 'focus' && renderFocus()}
          {activeTab === 'calendar' && renderCalendar()}
          {activeTab === 'add' && renderAdd()}
          {activeTab === 'settings' && renderSettings()}
        </ScrollView>
      </KeyboardAvoidingView>

      {selectedItem ? (
        <View style={styles.detailOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelectedItem(null)}
            style={styles.detailBackdrop}
          />
          <View style={styles.detailSheet}>
            <ExamCard item={selectedItem} detailed onOpen={openSource} />
            <TouchableOpacity
              activeOpacity={0.84}
              onPress={() => setSelectedItem(null)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            activeOpacity={0.84}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SettingsBlock({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <TouchableOpacity
              activeOpacity={0.84}
              key={option}
              onPress={() => onToggle(option)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {active ? '✓ ' : ''}{option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function InfoBox({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoTitle}>{title}</Text>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function StatCard({
  accent,
  label,
  value,
}: {
  accent: 'cyan' | 'violet' | 'green' | 'orange' | 'gray';
  label: string;
  value: number;
}) {
  return (
    <View style={[styles.statCard, styles[`statCard_${accent}`]]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CategoryEntry({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.categoryEntry}>
      <Text style={styles.categoryEntryLabel}>{label}</Text>
      <Text style={styles.categoryEntryValue}>{value}</Text>
    </View>
  );
}

function DashboardBlock({
  title,
  items,
  emptyText,
  onPress,
  onOpen,
}: {
  title: string;
  items: ExamItem[];
  emptyText: string;
  onPress: (item: ExamItem) => void;
  onOpen: (item: ExamItem) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ExamList
        compact
        emptyText={emptyText}
        items={items.slice(0, 3)}
        onPress={onPress}
        onOpen={onOpen}
      />
    </View>
  );
}

function ExamList({
  compact,
  emptyText = '暂无报名信息',
  items,
  onPress,
  onOpen,
}: {
  compact?: boolean;
  emptyText?: string;
  items: ExamItem[];
  onPress: (item: ExamItem) => void;
  onOpen: (item: ExamItem) => void;
}) {
  if (items.length === 0) {
    return <InfoBox title={emptyText} body="可以调整筛选条件，或手动添加新的报名通知。" />;
  }

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <ExamCard compact={compact} item={item} key={item.id} onOpen={onOpen} onPress={onPress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    paddingBottom: 34,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  appLabel: {
    color: '#79e8ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  appTitle: {
    color: '#f8fbff',
    fontSize: 30,
    fontWeight: '900',
  },
  quickAddButton: {
    backgroundColor: '#5b5ff7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickAddText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  tabs: {
    marginBottom: 14,
  },
  tabButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderColor: '#233b63',
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  tabButtonActive: {
    backgroundColor: '#2f6bff',
    borderColor: '#79e8ff',
  },
  tabButtonText: {
    color: '#9bb4d5',
    fontSize: 14,
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#ffffff',
  },
  hero: {
    backgroundColor: '#111a33',
    borderColor: '#335dff',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 18,
  },
  radarOrb: {
    alignItems: 'center',
    backgroundColor: 'rgba(121, 232, 255, 0.13)',
    borderColor: '#79e8ff',
    borderRadius: 38,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 16,
    width: 76,
  },
  radarOrbText: {
    color: '#79e8ff',
    fontSize: 34,
    fontWeight: '900',
  },
  heroEyebrow: {
    color: '#79e8ff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 31,
    marginBottom: 10,
  },
  heroMeta: {
    color: '#a9bce0',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  dataNotice: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  dataNoticeTitle: {
    color: '#f8fbff',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  feedStatusText: {
    color: '#79e8ff',
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 19,
    marginBottom: 4,
  },
  dataNoticeText: {
    color: '#9bb4d5',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#f8fbff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  mutedText: {
    color: '#9bb4d5',
    fontSize: 14,
    lineHeight: 21,
  },
  alertCard: {
    backgroundColor: 'rgba(124, 45, 18, 0.62)',
    borderColor: '#fb923c',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 13,
  },
  alertCardCritical: {
    backgroundColor: 'rgba(127, 29, 29, 0.72)',
    borderColor: '#f97316',
  },
  alertLabel: {
    color: '#fed7aa',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  alertText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  alertSubText: {
    color: '#fed7aa',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  infoBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: 14,
  },
  infoTitle: {
    color: '#f8fbff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  infoBody: {
    color: '#9bb4d5',
    fontSize: 13,
    lineHeight: 19,
  },
  list: {
    gap: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    borderRadius: 8,
    borderWidth: 1,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statCard_cyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.13)',
    borderColor: '#22d3ee',
  },
  statCard_violet: {
    backgroundColor: 'rgba(124, 58, 237, 0.16)',
    borderColor: '#a78bfa',
  },
  statCard_green: {
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderColor: '#4ade80',
  },
  statCard_orange: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderColor: '#fb923c',
  },
  statCard_gray: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: '#64748b',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: '#b8c7e6',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  categoryEntry: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderColor: '#335dff',
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: '47%',
    padding: 14,
  },
  categoryEntryLabel: {
    color: '#dbe8ff',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  categoryEntryValue: {
    color: '#79e8ff',
    fontSize: 22,
    fontWeight: '900',
  },
  focusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  focusTile: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 13,
  },
  focusTitle: {
    color: '#f8fbff',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginBottom: 8,
  },
  focusCount: {
    color: '#79e8ff',
    fontSize: 14,
    fontWeight: '900',
  },
  filterPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#111a33',
    borderColor: '#263f6c',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#2f6bff',
    borderColor: '#79e8ff',
  },
  chipText: {
    color: '#9bb4d5',
    fontSize: 13,
    fontWeight: '800',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  monthControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#d9e5e8',
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 46,
  },
  navButtonText: {
    color: '#102027',
    fontSize: 30,
    lineHeight: 32,
  },
  monthControlTitle: {
    color: '#102027',
    fontSize: 18,
    fontWeight: '900',
  },
  formPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#d9e5e8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  input: {
    backgroundColor: '#f8fbfc',
    borderColor: '#d6e1e5',
    borderRadius: 8,
    borderWidth: 1,
    color: '#102027',
    fontSize: 15,
    minHeight: 46,
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  noteInput: {
    minHeight: 84,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0f766e',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#0f766e',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: '#0f766e',
    fontSize: 15,
    fontWeight: '900',
  },
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  detailSheet: {
    backgroundColor: '#eef5f7',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    maxHeight: '86%',
    padding: 14,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#102027',
    borderRadius: 8,
    marginTop: 10,
    minHeight: 46,
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
});
