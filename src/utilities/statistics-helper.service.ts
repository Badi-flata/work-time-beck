// ═══════════════════════════════════════════════════════════════
// StatisticsHelperService — الطبقة المركزية للحسابات الإحصائية
// ═══════════════════════════════════════════════════════════════

import { Injectable } from '@nestjs/common';
import { PrismaService } from "./../prisma/prisma.service";
import { AttendanceStatus } from '@prisma/client';
import { startOfDay, addDays , format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import {
  AttendanceSummary,
  DisciplineRate,
  PeriodSummary,
  EnrichedEmployee,
  DailyBreakdownEntry
} from './types/statistics.types';
import { DisciplineRating } from './types/dashboard-registry.types';

const TZ = 'Asia/Riyadh';

@Injectable()
export class StatisticsHelperService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  // 1. summarizeAttendances — الدالة الأساسية لكل الإحصائيات
  // ═══════════════════════════════════════════════════════════════
  // دالة نقية (Pure Function) — لا تستعلم من قاعدة البيانات
  // تأخذ مصفوفة سجلات حضور خام وتُعيد ملخصاً إحصائياً موحداً بتمريرة واحدة O(n)
  summarizeAttendances(attendances: any[] , shiftName?:string): AttendanceSummary {
    const totalDays = attendances.length;

    let onTimeDays  =  0;
    let lateDays    =  0;  
    let absentDays  =  0;
    let excusedDays =  0;
    let escapedDays =  0;
    let deductionDays = 0;
    let earlyDepartureDays = 0;

    let totalWorkedMinutes = 0;
    let totalDelayMinutes = 0;
    let totalDeductions = 0;
    let totalEarlyLeaveMinutes = 0;
    
    const dailyBreakdown: DailyBreakdownEntry[] = [];
    
    for (let i = 0; i < totalDays; i++) {
      const a = attendances[i];
      const excusesArray  = a.excuses && a.excuses.length > 0 ? a.excuses.filter((e: any) => e.isApproved) : [];
      const hasLateExcuse = excusesArray.some((e: any) => e.type === "LATE");
      const hasAbsentExcuse = excusesArray.some((e: any) => e.type === "ABSENT");
      const hasEarlyDepartureExcuse = excusesArray.some((e: any) => e.type === "EARLY_DEPARTURE");
      const status = a.status;
      let deduction = 0;

      if (status === AttendanceStatus.ON_TIME) {
        onTimeDays++;
      } else if (status === AttendanceStatus.LATE) {
        lateDays++;
      } else if (status === AttendanceStatus.ABSENT) {
        absentDays++;
      } else if (status === AttendanceStatus.EXCUSED || hasLateExcuse || hasAbsentExcuse || hasEarlyDepartureExcuse) {
        excusedDays++;
      } else if (status === AttendanceStatus.ESCAPY) {
        escapedDays++;
      }

      if ((a.earlyLeaveMinutes ?? 0) > 0) {
        earlyDepartureDays++;
      }
      if ((a.salaryDeduction ?? 0) > 0) {
        deductionDays++;
        deduction = a.salaryDeduction ?? 0;
        totalDeductions += deduction;
      }

      totalWorkedMinutes     += (a.totalWorkedHours ?? 0) * 60;
      totalDelayMinutes      += a.delayMinutes ?? 0;
      totalEarlyLeaveMinutes += a.earlyLeaveMinutes ?? 0;

      const notes = [a.adminNotes || a.adminNote, a.employeeNote].filter(Boolean).join(' | ') || null;
      const checkIn = a.checkIn ? format(a.checkIn, "HH:mm") : null;
      const checkOut = a.checkOut ? format(a.checkOut, "HH:mm") : null;
      const excuseNotes = excusesArray.map((e: any) => e.reason).join(' , ') || null;
      dailyBreakdown.push({
        attendanceId: a.id,
        date: format(toZonedTime(a.date, TZ), 'yyyy-MM-dd'),
        status: a.status,
        checkIn,
        checkOut,
        managerName: a.managerName || 'بدون مدير',
        departmentName: a.departmentName || 'بدون قسم',
        shiftName: a.shiftName || 'بدون وردية',
        shiftStart: a.shiftStart || "07:00",
        shiftEnd: a.shiftEnd || '18:00',
        graceIn: a.graceIn || 15,
        graceOut: a.graceOut || 30,
        totalWorkedHours: a.totalWorkedHours || 0,
        lateMinutes: a.lateMinutes ?? 0,
        earlyLeaveMinutes: a.earlyLeaveMinutes ?? 0,
        deduction,
        notes: notes || "",
        excuses: excusesArray,
        excuseNotes,
      });
    }

        const rate =
      totalDays > 0
        ? Math.round((onTimeDays / totalDays) * 100)
        : 0; // لا يوجد سجلات = لا مخالفات

    const label = this.computeDisciplineRating(rate);

    return {
      rate,
      label,
      days:dailyBreakdown,
      summary:{
          totalDays,
          presentDays: onTimeDays + lateDays,
          onTimeDays,
          lateDays,
          absentDays,
          excusedDays,
          escapedDays,
          deductionDays,
          earlyDepartureDays,
          totalWorkedMinutes,
          totalWorkedHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
          totalDelayMinutes,
          totalDeductions,
          totalEarlyLeaveMinutes,
    }
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

    const {summary} = this.summarizeAttendances(attendances);
    const rate =
      summary.totalDays > 0
        ? Math.round((summary.onTimeDays / summary.totalDays) * 100)
        : 0; // لا يوجد سجلات = لا مخالفات

    const label = this.computeDisciplineRating(rate);

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
  // 3. enrichEmployeeData — إثراء بيانات الموظف
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
    const start = startOfDay(addDays(now, - days));

    // جلب سجلات الحضور لآخر N يوم
    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: profileId,
        date: { gte: start },
      },
    });

    const {summary }= this.summarizeAttendances(attendances);

    let disciplineRate: DisciplineRate | undefined;
    if (options?.includeDiscipline !== false) {
      const rate =
        summary.totalDays > 0
          ? Math.round(
              (summary.onTimeDays / summary.totalDays) * 100,
            )
          : 100;

      const label = this.computeDisciplineRating(rate);

      disciplineRate = {
        rate,
        label,
        totalDays: summary.totalDays,
        onTimeDays: summary.onTimeDays,
        lateDays: summary.lateDays,
        absentDays: summary.absentDays,
      };
    }

    return {
      ...employeeProfile,
      disciplineRate,
      summary,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. computePeriodSummary — ملخص تقرير أسبوعي/شهري
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: weekly-report, monthly-report (المدير + الموظف)
  // يأخذ سجلات حضور الفترة → يُعيد ملخص + السجلات الخام
  computePeriodSummary(attendances: any[]): PeriodSummary {
    const summary = this.summarizeAttendances(attendances);
    return {
      summary
    };
  }

 
  // ═══════════════════════════════════════════════════════════════
  // 8. computeDisciplineRating — إرجاع التقييم بالإنجليزية للـ DTO الموحد
  // ═══════════════════════════════════════════════════════════════
  computeDisciplineRating(rate: number): DisciplineRating {
    if (rate >= 95) return 'EXCELLENT';
    if (rate >= 85) return 'VERY_GOOD';
    if (rate >= 60) return 'GOOD';
    return 'NEEDS_IMPROVEMENT';
  }
}
