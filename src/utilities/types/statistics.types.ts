// أنواع الإحصائيات المشتركة — Shared Statistics Types
// تُستخدم من قِبل StatisticsHelperService وجميع الـ endpoints

import { DisciplineRating } from "./dashboard-registry.types";

export interface DirectoryUserOutput {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'SUPER_ADMIN';
  imageProfile?: string;
  createdAt: string;
  employeeProfile?: {
    id: string;
    userId?: string;
    isWorking: boolean;
    salary: number;
    managerId?: string | null;
    departmentId?: string | null;
    shiftId?: string | null;
    department?: { id: string; name: string; description?: string } | null;
    shift?: { id: string; name: string; startTime: string; endTime: string; gracePeriodMinIn?: number; gracePeriodMinOut?: number } | null;
    disciplineRate?: { rate: number; label: string ;periodCountDiscipline:string };
  } | null;
  adminProfile?: {
    id: string;
    userId?: string;
    managedDepartments?: {
      id: string;
      name: string;
      description?: string;
      shift?: { id: string; name: string; startTime: string; endTime: string }[];
      organizationDiscipline?: { rate: number; label: string }[]
    }[];
    subordinates?: { id: string; user?: { fullName: string } ; discipline?: { rate: number; label: string }}[];
  } | null;
   organizationDiscipline?: { rate: number; label: string ;periodCountDiscipline:string }
}
interface excuse{
  type:"LATE"|"ABSENT"|"EARLY_DEPARTURE"
  reason:string
  isApproved:boolean
}
export interface DailyBreakdownEntry {
  attendanceId:string;
  date: string;                 // YYYY-MM-DD
  managerName:string;
  departmentName:string;
  shiftName:string;
  status: string;               // ON_TIME | LATE | ABSENT | EXCUSED | ESCAPY
  checkIn: string | null;       // ISO time or null
  checkOut: string | null;
  earlyLeaveMinutes: number;
  deduction: number;
  excuses: excuse[] | [];
  shiftStart:string;
  shiftEnd:string;
  graceIn:number;
  graceOut:number;
  notes?:string;
  totalWorkedHours:number;
  lateMinutes:number;
  excuseNotes?: string | null;
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
  rate:         number;          // 0-100
  label:        string;         // "ممتاز" | "جيد جداً" | "جيد" | "يحتاج تحسين" | "EXCELLENT" | ...
  periodCountDiscipline?: string;         // e.g. "شهر يونيو 2026 (01 يونيو 2026 ↔ 30 يونيو 2026)"
  includeSum?:{ 
    totalDays:    number;
    onTimeDays:   number;
    lateDays:     number;
    absentDays:   number;
  };
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
