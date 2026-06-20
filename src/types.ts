export type CertificateType = '初级教练员证' | '二级裁判员证' | '乒乓球二级裁判员证';

export type ExamStatus = '未开始' | '报名中' | '即将截止' | '已截止' | '待核验';

export type RegionFilter = '山西' | '江西' | '全国';

export type TimeFilter = '全部' | '最近7天' | '最近30天';

export type DataSourceType = 'official' | 'manual' | 'mock';

export type ExamItem = {
  id: string;
  title: string;
  certificateType: CertificateType;
  province: string;
  city: string;
  organization: string;
  registrationStartDate: string;
  registrationEndDate: string;
  examDate: string;
  location: string;
  sourceUrl: string;
  status: ExamStatus;
  lastCheckedAt: string;
  note: string;
  isMock: boolean;
  verified: boolean;
  dataSourceType: DataSourceType;
};

export type CalendarEventMap = Record<
  string,
  {
    deadline: number;
    exam: number;
    start: number;
  }
>;

export type Settings = {
  certificateTypes: CertificateType[];
  regions: RegionFilter[];
  lastUpdatedAt: string;
};
