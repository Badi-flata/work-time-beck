// أنواع الإحصائيات المشتركة — Shared Statistics Types
// تُستخدم من قِبل StatisticsHelperService وجميع الـ endpoints

import { DisciplineRating } from "./dashboard-registry.types";

export interface DailyBreakdownEntry {
  date: string;                 // YYYY-MM-DD
  managerName:string;
  departmentName:string;
  shiftName:string;
  status: string;               // ON_TIME | LATE | ABSENT | EXCUSED | ESCAPY
  checkIn: string | null;       // ISO time or null
  checkOut: string | null;
  earlyLeaveMinutes: number;
  deduction: number;
  excuseNotes: string | null;
  shiftStart:string;
  shiftEnd:string;
  graceIn:number;
  graceOut:number;
  notes?:string;
  totalWorkedHours:number;
  lateMinutes:number;
}
export interface AttendanceSummary {
  rate: number;
  label: DisciplineRating;
  days: DailyBreakdownEntry[]
 summary:{ 
  totalDays: number;
  presentDays: number;
  onTimeDays: number;
  lateDays: number;
  absentDays: number;
  excusedDays: number;
  escapedDays: number;
  earlyDepartureDays: number;
  deductionDays: number;
  totalDeductions: number;
  totalWorkedMinutes: number;
  totalWorkedHours: number;
  totalDelayMinutes: number;
  totalEarlyLeaveMinutes: number;}
  
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
}

export interface EnrichedEmployee {
  disciplineRate?: DisciplineRate;
  attendanceSummary?: {summary:AttendanceSummary};
    [key: string]: any;
}
