// ── أنواع الاستجابة الموحدة للوحة التحكم (Dashboard Registry) ──

/** الإحصائيات العلوية — Top Metric Cards */
export interface DashboardMetrics {
  mode: 'daily' | 'weekly' | 'monthly';
  periodLabel: string;           // مثل "الأسبوع الثاني: 2026-05-08 ← 2026-05-14" أو "2026-05-30"
  totalEmployees: number;
  presentCount: number;          // عدد الموظفين الحاضرين الفريدين خلال الفترة
  lateCount: number;             // عدد حالات التأخير الكلي في الفترة
  excusedCount: number;          // عدد حالات الأعذار الكلية في الفترة
  earlyDepartureCount: number;   // عدد حالات الخروج المبكر الكلية في الفترة
  deductedCount: number;         // عدد الموظفين المخصوم منهم خلال الفترة حصراً
}

/** صف جدول الوضع اليومي */
export interface DailyTableRow {
  employeeProfileId: string;
  fullName: string;              // أولوية 1
  status: string;                // أولوية 2: ON_TIME | LATE | ABSENT | EXCUSED | ESCAPY
  checkIn: Date | null;          // أولوية 3
  checkOut: Date | null;         // أولوية 4
  todayDeduction: number;        // أولوية 5: الخصم المالي لليوم
  jobTitle: string | null;
  departmentName: string;
  shiftHours: string;            // "08:00 - 16:00"
  isExcusedIn: boolean;
  isExcusedOut: boolean;
  excuseReasonIn: string | null;
  excuseReasonOut: string | null;
}

/** صف جدول الوضع الأسبوعي/الشهري */
export interface PeriodTableRow {
  employeeProfileId: string;
  fullName: string;              // أولوية 1
  disciplineRate: number;        // أولوية 2: 0-100
  disciplineLabel: string;       // أولوية 3: ممتاز | جيد جداً | جيد | يحتاج تحسين
  periodDeductions: number;      // أولوية 4: مجموع الخصومات خلال الفترة حصراً
  presentDays: number;
  absentDays: number;
  lateDays: number;
  earlyDepartureCount: number;
  jobTitle: string | null;
  departmentName: string;
}

/** الاستجابة الموحدة */
export interface DashboardRegistryResponse {
  metrics: DashboardMetrics;
  table: DailyTableRow[] | PeriodTableRow[];
}
