// ═══════════════════════════════════════════════════════════════
// StatisticsHelperService — الطبقة المركزية للحسابات الإحصائية
// ═══════════════════════════════════════════════════════════════
// هذا الملف يحتوي على الدوال الجامعة التي تُستدعى من جميع الـ endpoints
// لتجنب تكرار الكود وضمان اتساق العمليات الحسابية

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  AttendanceSummary,
  DisciplineRate,
  DashboardCounts,
  DashboardStats,
  PeriodSummary,
  EnrichedEmployee,
} from './types/statistics.types';

const TZ = 'Asia/Riyadh';

@Injectable()
export class StatisticsHelperService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. summarizeAttendances — الدالة الأساسية لكل الإحصائيات
  // ═══════════════════════════════════════════════════════════════
  // دالة نقية (Pure Function) — لا تستعلم من قاعدة البيانات
  // تأخذ مصفوفة سجلات حضور خام وتُعيد ملخصاً إحصائياً موحداً
  summarizeAttendances(attendances: any[]): AttendanceSummary {
    const totalDays = attendances.length;

    const onTimeDays = attendances.filter(
      (a) => a.status === AttendanceStatus.ON_TIME,
    ).length;

    const lateDays = attendances.filter(
      (a) => a.status === AttendanceStatus.LATE,
    ).length;

    const absentDays = attendances.filter(
      (a) => a.status === AttendanceStatus.ABSENT,
    ).length;

    const excusedDays = attendances.filter(
      (a) => a.status === AttendanceStatus.EXCUSED,
    ).length;

    const escapedDays = attendances.filter(
      (a) => a.status === AttendanceStatus.ESCAPY,
    ).length;

    const earlyDepartureCount = attendances.filter(
      (a) => (a.earlyLeaveMinutes ?? 0) > 0,
    ).length;

    const totalWorkedMinutes = attendances.reduce(
      (sum, a) => sum + (a.totalWorkedMinutes ?? 0),
      0,
    );

    const totalDelayMinutes = attendances.reduce(
      (sum, a) => sum + (a.delayMinutes ?? 0),
      0,
    );

    const totalEarlyLeaveMinutes = attendances.reduce(
      (sum, a) => sum + (a.earlyLeaveMinutes ?? 0),
      0,
    );

    return {
      totalDays,
      presentDays: onTimeDays + lateDays,
      onTimeDays,
      lateDays,
      absentDays,
      excusedDays,
      escapedDays,
      earlyDepartureCount,
      totalWorkedMinutes,
      totalWorkedHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
      totalDelayMinutes,
      totalEarlyLeaveMinutes,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. computeDisciplineRate — حساب معدل الانضباط
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: profile, search, my-employees, dashboard, daily-report
  // المعادلة: (أيام ON_TIME ÷ إجمالي الأيام المسجلة) × 100
  async computeDisciplineRate(
    employeeProfileId: string,
    days: number = 30,
  ): Promise<DisciplineRate> {
    const now = toZonedTime(Date.now(), TZ);
    const start = startOfDay(addDays(now, -days));

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId,
        date: { gte: start },
      },
    });

    const summary = this.summarizeAttendances(attendances);
    const rate =
      summary.totalDays > 0
        ? Math.round((summary.onTimeDays / summary.totalDays) * 100)
        : 100; // لا يوجد سجلات = لا مخالفات

    let label: string;
    if (rate >= 95) label = 'ممتاز';
    else if (rate >= 85) label = 'جيد جداً';
    else if (rate >= 70) label = 'جيد';
    else label = 'يحتاج تحسين';

    return {
      rate,
      label,
      totalDays: summary.totalDays,
      onTimeDays: summary.onTimeDays,
      lateDays: summary.lateDays,
      absentDays: summary.absentDays,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. computeDashboardStats — إحصائيات لوحة التحكم
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: dashboard, daily-report
  // يأخذ مصفوفة المرؤوسين (كل منهم يحتوي .attendances[] لليوم المطلوب)
  // يُصنف الموظفين حسب الحالة ويحسب إحصائيات إضافية
  computeDashboardStats(subordinates: any[]): DashboardStats {
    const present: any[] = [];
    const absent: any[] = [];
    const excused: any[] = [];
    const escaped: any[] = [];
    const late: any[] = [];
    const onTime: any[] = [];

    let earlyDeparture = 0;
    let deducted = 0;
    let checkedOut = 0;
    let notCheckedOut = 0;

    for (const emp of subordinates) {
      const att = emp.attendances?.[0];

      if (!att || att.status === AttendanceStatus.ABSENT) {
        absent.push(emp);
      } else if (att.status === AttendanceStatus.EXCUSED) {
        excused.push(emp);
      } else if (att.status === AttendanceStatus.ESCAPY) {
        escaped.push(emp);
      } else if (att.checkIn) {
        // حاضر (ON_TIME أو LATE)
        present.push(emp);
        if (att.status === AttendanceStatus.LATE) {
          late.push(emp);
        } else {
          onTime.push(emp);
        }
      } else {
        absent.push(emp);
      }

      // إحصائيات إضافية
      if (att && (att.earlyLeaveMinutes ?? 0) > 0) {
        earlyDeparture++;
      }

      // إصلاح Bug 2: عدد المخصوم منهم في اليوم الفعلي بدلاً من التراكمي
      if (att && this.hasDeductibleOffense(att)) {
        deducted++;
      }

      // حالة الانصراف
      if (att?.checkOut) {
        checkedOut++;
      } else if (att?.checkIn && !att?.checkOut) {
        notCheckedOut++;
      }
    }

    const counts: DashboardCounts = {
      total: subordinates.length,
      present: present.length,
      absent: absent.length,
      excused: excused.length,
      escaped: escaped.length,
      late: late.length,
      onTime: onTime.length,
      earlyDeparture,
      deducted,
      checkedOut,
      notCheckedOut,
    };

    return {
      counts,
      details: { present, absent, excused, escaped, late, onTime },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. enrichEmployeeData — إثراء بيانات الموظف
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: profile, my-employees, search
  // يُضيف: disciplineRate + attendanceSummary (آخر 30 يوم)
  async enrichEmployeeData(
    employeeProfile: any,
    options?: { includeDiscipline?: boolean; disciplineDays?: number },
  ): Promise<EnrichedEmployee> {
    const profileId = employeeProfile.id;
    const days = options?.disciplineDays ?? 30;
    const now = toZonedTime(Date.now(), TZ);
    const start = startOfDay(addDays(now, -days));

    // جلب سجلات الحضور لآخر N يوم
    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: profileId,
        date: { gte: start },
      },
    });

    const attendanceSummary = this.summarizeAttendances(attendances);

    let disciplineRate: DisciplineRate | undefined;
    if (options?.includeDiscipline !== false) {
      const rate =
        attendanceSummary.totalDays > 0
          ? Math.round(
              (attendanceSummary.onTimeDays / attendanceSummary.totalDays) * 100,
            )
          : 100;

      let label: string;
      if (rate >= 95) label = 'ممتاز';
      else if (rate >= 85) label = 'جيد جداً';
      else if (rate >= 70) label = 'جيد';
      else label = 'يحتاج تحسين';

      disciplineRate = {
        rate,
        label,
        totalDays: attendanceSummary.totalDays,
        onTimeDays: attendanceSummary.onTimeDays,
        lateDays: attendanceSummary.lateDays,
        absentDays: attendanceSummary.absentDays,
      };
    }

    return {
      ...employeeProfile,
      disciplineRate,
      attendanceSummary,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. computePeriodSummary — ملخص تقرير أسبوعي/شهري
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: weekly-report, monthly-report (المدير + الموظف)
  // يأخذ سجلات حضور الفترة → يُعيد ملخص + السجلات الخام
  computePeriodSummary(attendances: any[]): PeriodSummary {
    const summary = this.summarizeAttendances(attendances);
    return {
      summary,
      records: attendances,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. hasDeductibleOffense — هل السجل يحتوي على مخالفة خصم
  // ═══════════════════════════════════════════════════════════════
  hasDeductibleOffense(att: any): boolean {
    if (!att) return false;
    const { status, isExcusedIn, isExcusedOut, delayMinutes, earlyLeaveMinutes } = att;

    // 1. تأخر غير معذور
    if (!isExcusedIn && (delayMinutes ?? 0) > 0) return true;

    // 2. مغادرة مبكرة غير معذورة
    if (!isExcusedOut && (earlyLeaveMinutes ?? 0) > 0) return true;

    // 3. هروب دون تسجيل انصراف
    if (status === AttendanceStatus.ESCAPY) return true;

    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. computeDailyDeduction — حساب الخصم اليومي المالي في الذاكرة دون تعديل DB
  // ═══════════════════════════════════════════════════════════════
  computeDailyDeduction(att: any, baseSalary: number): number {
    if (!att || baseSalary <= 0) return 0;

    const { status, isExcusedIn, isExcusedOut, delayMinutes, earlyLeaveMinutes } = att;

    // المعدل الدقيقي: الراتب ÷ (22 يوم × 8 ساعات × 60 دقيقة) = salary ÷ 10560
    const minuteRate = baseSalary / (22 * 8 * 60);
    // معدل اليوم الكامل: الراتب ÷ 22 يوم عمل
    const dailyRate = baseSalary / 22;

    let todayDeduction = 0;

    // 1. خصم التأخر في الحضور (بدون عذر)
    if (!isExcusedIn && (delayMinutes ?? 0) > 0) {
      todayDeduction += Math.ceil((delayMinutes ?? 0) * minuteRate);
    }

    // 2. خصم المغادرة المبكرة (بدون عذر)
    if (!isExcusedOut && (earlyLeaveMinutes ?? 0) > 0) {
      todayDeduction += Math.ceil((earlyLeaveMinutes ?? 0) * minuteRate);
    }

    // 3. ESCAPY: خصم يوم كامل، نأخذ الأعلى لضمان عقوبة كاملة دون مضاعفة
    if (status === AttendanceStatus.ESCAPY) {
      const escapyDeduction = Math.ceil(dailyRate);
      todayDeduction = Math.max(todayDeduction, escapyDeduction);
    }

    return todayDeduction;
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. computeDisciplineLabel — إرجاع التقييم العربي بناءً على النسبة
  // ═══════════════════════════════════════════════════════════════
  computeDisciplineLabel(rate: number): string {
    if (rate >= 95) return 'ممتاز';
    if (rate >= 85) return 'جيد جداً';
    if (rate >= 70) return 'جيد';
    return 'يحتاج تحسين';
  }
}
