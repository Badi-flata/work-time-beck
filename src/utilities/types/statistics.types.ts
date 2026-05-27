// أنواع الإحصائيات المشتركة — Shared Statistics Types
// تُستخدم من قِبل StatisticsHelperService وجميع الـ endpoints

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  onTimeDays: number;
  lateDays: number;
  absentDays: number;
  excusedDays: number;
  escapedDays: number;
  earlyDepartureCount: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalDelayMinutes: number;
  totalEarlyLeaveMinutes: number;
}

export interface DisciplineRate {
  rate: number;          // 0-100
  label: string;         // "ممتاز" | "جيد جداً" | "جيد" | "يحتاج تحسين"
  totalDays: number;
  onTimeDays: number;
  lateDays: number;
  absentDays: number;
}

export interface DashboardCounts {
  total: number;
  present: number;
  absent: number;
  excused: number;
  escaped: number;
  late: number;
  onTime: number;
  earlyDeparture: number;
  deducted: number;
  checkedOut: number;
  notCheckedOut: number;
}

export interface DashboardStats {
  counts: DashboardCounts;
  details: Record<string, any[]>;
  filteredList?: any[];
}

export interface PeriodSummary {
  summary: AttendanceSummary;
  records: any[];
}

export interface EnrichedEmployee {
  disciplineRate?: DisciplineRate;
  attendanceSummary?: AttendanceSummary;
  [key: string]: any;
}
