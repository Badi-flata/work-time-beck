// ── types/dashboard-registry.types.ts ──

export type DisciplineRating =  'ALL' | 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'NEEDS_IMPROVEMENT';

export type StatusFilter = 'ALL' | 'ON_TIME' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'ESCAPY';

export enum Modes { ALL = 'ALL', DAILY = 'DAILY', WEEKLY = 'WEEKLY', MONTHLY = 'MONTHLY' };

export interface PeriodScope {
  start: string; // ISO String (Date only, yyyy-MM-dd)
  end: string;   // ISO String (Date only, yyyy-MM-dd)
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface DashboardMeta {
  RatingOrginzation:number;
  OrginzationLabel:DisciplineRating;
  periodScope: string;
  totalSubordinates: number;
  activeShiftContext: string; // e.g., "الإدارة العامة - الوردية الصباحية"
  pagination: PaginationMeta;
}

export interface AggregatedMetrics {
  totalPresent: number;
  totalLateOccurrences: number;
  totalExcused: number;
  totalAbsent:number;
  totalEscaped:number;
  totalEarlyLeaves: number;
  totalDeductedEmployeesCount: number;
}

export interface DailyBreakdownEntry {
  date: string;                 // YYYY-MM-DD
  managerName:string;
  departmentName:string;
  shiftName:string;
  status: string;               // ON_TIME | LATE | ABSENT | EXCUSED | ESCAPY
  checkIn: string | null;       // ISO time or null
  checkOut: string | null;
  shiftStart:string;
  shiftEnd:string;
  graceIn:number|15;
  graceOut:number|30;
  totalWorkedHours:number|0;
  lateMinutes:number|0
  earlyLeaveMinutes:number|0
  deduction: number|0;
  excuseNotes: string | null;
  note?:string;
}

export interface EmployeeSummary {
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
  totalEarlyLeaveMinutes: number;
}

export interface RegistryEntry {
  employeeId: string;
  name: string;
  jobTitle: string;                 
  avatar: string; 
  rate: number;              
  disciplineRating: DisciplineRating;
  summary: EmployeeSummary;
  dailyBreakdown: DailyBreakdownEntry[];
}

export interface OptimizedDashboardResponse {
  meta: DashboardMeta;
  aggregatedMetrics: AggregatedMetrics;
  registry: RegistryEntry[];
}
