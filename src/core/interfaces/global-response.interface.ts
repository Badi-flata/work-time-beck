/**
 * Global Response & Customizable Interfaces
 * واجهات الاستجابة العامة والأنماط القابلة للتخصيص
 */

import { DisciplineRating } from "src/utilities/types/dashboard-registry.types";

/**
 * نوع مساعد لتخصيص الحقول المطلوبة فقط من واجهة معينة (Selective Fields)
 * يمنع تقييد المدخلات أو إرجاع بيانات غير ضرورية
 */
export type PickFields<T, K extends keyof T> = Pick<T, K>;
export type OmitFields<T, K extends keyof T> = Omit<T, K>;
export type PartialInput<T> = Partial<T>;

/**
 * واجهة الاستجابة الناجحة العامة
 * تدعم أي نوع مخصص عبر Generic T مع بيانات وصفية اختيارية M
 */
export interface ApiSuccessResponse<T = any, M = any> {
  statusCode: number;
  message: string;
  data: T;
  meta?: M;
  timestamp: string;
}

/**
 * واجهة الاستجابة للأخطاء العامة
 * تُطابق الشكل الذي يُرجعه AllExceptionsFilter مع TraceId
 */
export interface ApiErrorResponse {
  statusCode: number;
  errorCategory: string;
  message: string;
  traceId: string;
  timestamp: string;
  path: string;
  method: string;
  cause?: string;
}

/**
 * واجهة التصفح (Pagination)
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * واجهة نتيجة Discipline Rate
 */
export interface DisciplineResult {
  rate: number;
  label: string;
  periodCountDiscipline: string;
  includeSum?: {
    totalDays: number;
    onTimeDays: number;
    lateDays: number;
    absentDays: number;
  };
  summary?: any;
}

/**
 * واجهة نتيجة Discipline Rate الشامل للمؤسسة/المدير
 */
export interface OrganizationDisciplineResult {
  organizationRate: number;
  organizationLabel: string;
  periodCountDiscipline: string;
  employeeRates: Array<{
    employeeId: string;
    name: string;
    rate: number;
    label: string;
  }>;
}

/**
 * واجهة بيانات وصفية مدمجة لقائمة الموظفين (تجمع التصفح والتقييم الشامل)
 */
export interface WorkersListMeta extends PaginationMeta {
  organizationRate?: number;
  organizationLabel?: string;
  periodCountDiscipline?: string;
   employeeRates: {
        employeeId: string;
        name: string;
        rate: number;
        label: DisciplineRating;
    }[];
}

/**
 * واجهة تقرير الفترة الزمنية المحددة (Bounded Period Report)
 */
export interface PeriodReportResult {
  periodLabel: string;
  rate: number;
  label: string;
  summary: any;
  records: any[];
}

/**
 * واجهة الملف المرفوع عبر Multer
 */
export interface UploadedFilePayload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}
