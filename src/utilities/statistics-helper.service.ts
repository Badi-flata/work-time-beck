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
import { DisciplineRating, Modes } from './types/dashboard-registry.types';
import { CalculatePeriodService } from './calculate-period.service';
import { ManagerProfileNotFoundException } from '../core/domain-exceptions/department.exceptions';

const TZ = 'Asia/Riyadh';

@Injectable()
export class StatisticsHelperService {
  constructor(
    private prisma: PrismaService,
    private calculatePeriod: CalculatePeriodService,
  ) {}

  /**
   * 0. calculateExpectedWorkingDays — حساب عدد أيام العمل المتوقعة في فترة محددة
   * مع إمكانية التخصيص واستمداد أيام الإجازة الأسبوعية والعطلات من الوردية (Shift) أو القسم (Department)
   */
  calculateExpectedWorkingDays(
    startDate: Date,
    endDate?: Date,
    options?: {
      shift?: { weekendDays?: number[]; workingDays?: number[] };
      department?: { weekendDays?: number[]; workingDays?: number };
      customWeekendDays?: number[];
      customHolidays?: string[];
    }
  ): number {
    const end = endDate ? new Date(endDate) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    // استخراج أيام العطلة الأسبوعية: من الوردية أو القسم أو الخيارات أو الافتراضي (الجمعة 5 والسبت 6)
    const weekendDays: number[] =
    options?.department?.weekendDays ||
      options?.customWeekendDays ||
      options?.shift?.weekendDays ||
      [5, 6];

    const holidaysSet = new Set(options?.customHolidays || []);

    let workingDaysCount = 0;
    const current = new Date(startDate);

    while (current < end) {
      const dayOfWeek = current.getUTCDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const dateStr = format(current, 'yyyy-MM-dd');

      const isWeekend = weekendDays.includes(dayOfWeek);
      const isHoliday = holidaysSet.has(dateStr);

      if (!isWeekend && !isHoliday) {
        workingDaysCount++;
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return workingDaysCount;
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. summarizeAttendances — الدالة الأساسية لكل الإحصائيات
  // ═══════════════════════════════════════════════════════════════
  // دالة نقية (Pure Function) — لا تستعلم من قاعدة البيانات
  // تأخذ مصفوفة سجلات حضور خام وتُعيد ملخصاً إحصائياً موحداً بتمريرة واحدة O(n)
  summarizeAttendances(
    attendances: any[],
    expectedWorkingDays: number =22,
    shiftName?: string,
  ): AttendanceSummary {
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
      const hasApprovedExcuse = hasLateExcuse || hasAbsentExcuse || hasEarlyDepartureExcuse;
      const status = a.status;
      let deduction = 0;

      // أولوية التحقق: الأعذار المعتمدة تُصنف كـ EXCUSED قبل الـ LATE
      if (status === AttendanceStatus.EXCUSED || hasApprovedExcuse) {
        excusedDays++;
      } else if (status === AttendanceStatus.ON_TIME) {
        onTimeDays++;
      } else if (status === AttendanceStatus.LATE) {
        lateDays++;
      } else if (status === AttendanceStatus.ABSENT) {
        absentDays++;
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

    // حساب معدل الانضباط: الاعتماد على أيام العمل المتوقعة في المقام
    const denominator = expectedWorkingDays !== undefined && expectedWorkingDays > 0
      ? expectedWorkingDays
      : totalDays;

    const rate =
      denominator > 0
        ? Math.min(100, Math.round(((onTimeDays + excusedDays) / denominator) * 100))
        : 0;

    const label = this.computeDisciplineRating(rate);

    return {
      rate,
      label,
      days: dailyBreakdown,
      summary: {
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
  // يُستدعى من: profile, search, my-employees, dashboard, daily-report, employee & managing controllers
  // يدعم كلاً من: days (عدد الأيام) أو mode (ALL, DAILY, WEEKLY, MONTHLY) مع dateAnchor
  async computeDisciplineRate(
    employeeProfileId: string,
    modeOrDays: Modes | number = Modes.MONTHLY,
    dateAnchor?: string,
    includeSummary?: boolean,
  ): Promise<DisciplineRate> {
    let startDate: Date;
    let endDate: Date | undefined;
    let periodCountDiscipline: string;

    if (typeof modeOrDays === 'number') {
      const now = toZonedTime(Date.now(), TZ);
      startDate = startOfDay(addDays(now, - modeOrDays));
      endDate = new Date(now);
      periodCountDiscipline = `آخر ${modeOrDays} يوم`;
    } else {
      const anchor = dateAnchor || format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
      const period = this.calculatePeriod.calculateMonthlyBoundedPeriod(modeOrDays, anchor);
      startDate = period.startDate;
      endDate = period.endDate;
      periodCountDiscipline = period.periodLabel;
    }

    // جلب بيانات القسم والوردية الخاصة بالموظف لاستخراج إعدادات أيام العمل والعطلات المخصصة
    const employeeProfile = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeProfileId },
      include: {
        shift: true,
        department: true,
      },
    });

    const nowUtc = new Date();
    const isCurrentPeriod = !endDate || endDate > nowUtc;
    const effectiveEndDate = isCurrentPeriod ? nowUtc : endDate;
  
    const dept = employeeProfile?.department;
    let expectedWorkingDays = this.calculateExpectedWorkingDays(
      startDate,
      effectiveEndDate,
      {
        shift: employeeProfile?.shift as any,
        department: dept as any,
      }
    );

    if (!isCurrentPeriod && dept?.monthlyWorkingDays && dept.monthlyWorkingDays > 0) {
      expectedWorkingDays = dept.monthlyWorkingDays;
    }

    const dateFilter: any = { gte: startDate };
    if (endDate) {
      dateFilter.lt = endDate;
    }

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId,
        date: dateFilter,
      },
    });

    const { summary, rate, label } = this.summarizeAttendances(attendances, expectedWorkingDays);
    
    let includeSum: any | undefined;
    if (includeSummary) {
      includeSum = { 
        totalDays: summary.totalDays,
        onTimeDays: summary.onTimeDays,
        lateDays: summary.lateDays,
        absentDays: summary.absentDays,
      };
    }

    return {
      rate,
      label,
      periodCountDiscipline,
      includeSum,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. computeOrganizationDiscipline — التقييم الشامل للمؤسسة أو القسم
  // ═══════════════════════════════════════════════════════════════
  async computeOrganizationDiscipline(
    managerUserId: string,
    mode: Modes = Modes.ALL,
    dateAnchor?: string,
    departmentId?: string,
  ) {

    const admin = await this.prisma.adminProfile.findFirst({
      where: { OR: [{ userId: managerUserId }, { id: managerUserId }] },
    });

    if (!admin) {
      throw new ManagerProfileNotFoundException();
    }

    const whereClause: any = departmentId
      ? { departmentId }
      : {
          OR: [
            { managerId: admin.id },
            { department: { managerId: admin.id } },
          ],
        };

    const employees = await this.prisma.employeeProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { fullName: true } },
        shift: true,
        department: true,
      },
    });

    if (employees.length === 0) {
      return {
        organizationRate: 0,
        organizationLabel: 'NEEDS_IMPROVEMENT' as DisciplineRating,
        periodCountDiscipline: '',
        employeeRates: [],
      };
    }

    const anchor = dateAnchor || format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    const period = this.calculatePeriod.calculateMonthlyBoundedPeriod(mode, anchor);
    const startDate = period.startDate;
    const endDate = period.endDate;
    const periodCountDiscipline = period.periodLabel;

    const dateFilter: any = { gte: startDate };
    if (endDate) {
      dateFilter.lt = endDate;
    }

    const employeeIds = employees.map((e) => e.id);

    // استعلام مجمع واحد لجميع سجلات حضور الفترة لجميع الموظفين (حل N+1 Query)
    const allAttendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: { in: employeeIds },
        date: {gte:startDate,lt:endDate},
      },
      include: {
        excuses: true,
      },
      orderBy: { date: 'asc' },
    });

    // تجميع السجلات حسب employeeProfileId في الذاكرة
    const attendanceMap = new Map<string, any[]>();
    for (const att of allAttendances) {
      const list = attendanceMap.get(att.employeeProfileId) || [];
      list.push(att);
      attendanceMap.set(att.employeeProfileId, list);
    }

    const employeeRates: Array<{
      employeeId: string;
      name: string;
      rate: number;
      label: DisciplineRating;
    }> = [];

    let totalRate = 0;

  for (const emp of employees) {
      const empAttendances = attendanceMap.get(emp.id) || [];
      const expectedWorkingDays = this.calculateExpectedWorkingDays(
        startDate,
        endDate,
        {
          shift: emp.shift as any,
          department: emp.department as any,
        }
      );

      const { rate, label } = this.summarizeAttendances(empAttendances, expectedWorkingDays);

      employeeRates.push({
        employeeId: emp.userId,
        name: emp.user.fullName,
        rate,
        label: label as DisciplineRating,
      });
      totalRate += rate;
    }

    const organizationRate = employees.length > 0 ? Math.round(totalRate / employees.length) : 0;
    const organizationLabel = this.computeDisciplineRating(organizationRate);

    return {
      organizationRate,
      organizationLabel,
      periodCountDiscipline,
      employeeRates,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. enrichEmployeeData — إثراء بيانات الموظف
  // ═══════════════════════════════════════════════════════════════
  // يُستدعى من: profile, my-employees, search
  // يُضيف: disciplineRate + attendanceSummary (آخر 30 يوم)
  async enrichEmployeeData(
    employeeProfile: any,
    options?: { includeDiscipline?: boolean; disciplineDays?: number; includeSum?: boolean },
  ): Promise<EnrichedEmployee> {
    const profileId = employeeProfile.id;
    const days = options?.disciplineDays ?? 30;
    const now = toZonedTime(Date.now(), TZ);
    const start = startOfDay(addDays(now, - days));

    const expectedWorkingDays = this.calculateExpectedWorkingDays(
      start,
      now,
      {
        shift: employeeProfile?.shift as any,
        department: employeeProfile?.department as any,
      }
    );

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: profileId,
        date: { gte: start },
      },
    });

    const { summary, label, rate } = this.summarizeAttendances(attendances, expectedWorkingDays);

    let disciplineRate: DisciplineRate | undefined;
    if (options?.includeDiscipline !== false) {
      let includeSum: any | undefined;
      if (options?.includeSum) {
        includeSum = { 
          totalDays: summary.totalDays,
          onTimeDays: summary.onTimeDays,
          lateDays: summary.lateDays,
          absentDays: summary.absentDays,
        };
      }

      disciplineRate = {
        rate,
        label,
        periodCountDiscipline: `آخر ${days} يوم`,
        includeSum,
      };
    }

    return {
      ...employeeProfile,
      disciplineRate,
      summary,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. computePeriodSummary — ملخص تقرير أسبوعي/شهري
  // ═══════════════════════════════════════════════════════════════
  computePeriodSummary(attendances: any[]): PeriodSummary {
    const summary = this.summarizeAttendances(attendances);
    return {
      summary,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. computeDisciplineRating — إرجاع التقييم بالإنجليزية للـ DTO الموحد
  // ═══════════════════════════════════════════════════════════════
  computeDisciplineRating(rate: number): DisciplineRating {
    if (rate >= 95) return 'EXCELLENT';
    if (rate >= 85) return 'VERY_GOOD';
    if (rate >= 60) return 'GOOD';
    return 'NEEDS_IMPROVEMENT';
  }
}
