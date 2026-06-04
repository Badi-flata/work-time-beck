// ── types/dashboard-registry.types.ts ──

export type DisciplineRating = 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'NEEDS_IMPROVEMENT';

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
  periodScope: PeriodScope;
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
  shift: string | null;
  status: string;               // ON_TIME | LATE | ABSENT | EXCUSED | ESCAPY
  checkIn: string | null;       // ISO time or null
  checkOut: string | null;
  earlyLeaveMinutes: number;
  dayDeduction: number;
  excuseNotes: string | null;
}

export interface EmployeeSummary {
  presentDays: number;
  absentDays: number;
  excusedDays: number;
  escapedDays: number;
  lateDays: number;
  earlyDepartureDays: number;
  totalDeductionsInPeriod: number;
}

export interface RegistryEntry {
  employeeId: string;
  name: string;
  role: string;                 // jobTitle
  avatar: string;               // imageProfile URL or empty string
  disciplineRating: DisciplineRating;
  summary: EmployeeSummary;
  dailyBreakdown: DailyBreakdownEntry[];
}

export interface OptimizedDashboardResponse {
  meta: DashboardMeta;
  aggregatedMetrics: AggregatedMetrics;
  registry: RegistryEntry[];
}
