import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  parseISO,
  startOfDay,
  addDays,
  addMonths,
  differenceInMinutes,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  format,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AttendanceStatus } from '@prisma/client';
import { StatisticsHelperService } from './statistics-helper.service';
import {
  OptimizedDashboardResponse,
  RegistryEntry,
  DailyBreakdownEntry,
} from './types/dashboard-registry.types';

const TZ = 'Asia/Riyadh';

@Injectable()
export class UtilitiesService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // 1. calculateMonthlyBoundedPeriod — حساب الفترات الزمنية بدقة
  // ─────────────────────────────────────────────────────────────
  calculateMonthlyBoundedPeriod(
    mode: 'ALL' | 'daily' | 'weekly' | 'monthly',
    dateAnchor: string,
    customStartDate?: string,
    customEndDate?: string,
  ) {
    const referenceDate = dateAnchor ? parseISO(dateAnchor) : toZonedTime(Date.now(), TZ);
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth(); // 0-indexed
    const day = referenceDate.getDate();

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (mode === 'daily') {
      startDate = startOfDay(referenceDate);
      endDate = addDays(startDate, 1);
      periodLabel = format(startDate, 'yyyy-MM-dd');
    } else if (mode === 'weekly') {
      let startDay: number;
      let endDay: number;
      let weekLabel: string;

      if (day <= 7) {
        startDay = 1;
        endDay = 7;
        weekLabel = 'الأسبوع الأول';
      } else if (day <= 14) {
        startDay = 8;
        endDay = 14;
        weekLabel = 'الأسبوع الثاني';
      } else if (day <= 21) {
        startDay = 15;
        endDay = 21;
        weekLabel = 'الأسبوع الثالث';
      } else if (day <= 28) {
        startDay = 22;
        endDay = 28;
        weekLabel = 'الأسبوع الرابع';
      } else {
        startDay = 29;
        const lastDay = new Date(year, month + 1, 0).getDate();
        endDay = lastDay;
        weekLabel = 'الأسبوع الخامس';
      }

      startDate = startOfDay(new Date(year, month, startDay));
      endDate = startOfDay(new Date(year, month, endDay + 1));

      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(new Date(year, month, endDay), 'yyyy-MM-dd');
      periodLabel = `${weekLabel}: ${formattedStart} ↔ ${formattedEnd}`;
      } else if (mode === 'monthly') {
      startDate = startOfMonth(referenceDate);
      endDate = startOfDay(addMonths(startDate, 1));
      
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const lastDayOfMonth = endOfMonth(referenceDate);
      const formattedEnd = format(lastDayOfMonth, 'yyyy-MM-dd');
      periodLabel = `شهر ${format(startDate, 'yyyy-MM')}: ${formattedStart} ↔ ${formattedEnd}`;
    } else {
      // ALL mode
      if (customStartDate) {
        startDate = startOfDay(parseISO(customStartDate));
      } else {
        startDate = startOfMonth(referenceDate);
      }

      if (customEndDate) {
        endDate = startOfDay(parseISO(customEndDate));
        // حماية الأداء: تقييد الفترة بـ 5 أشهر كأقصى حد
        const maxEnd = addMonths(startDate, 5);
        if (endDate > maxEnd) {
          endDate = maxEnd;
        }
      } else {
        // افتراضي:ثلاثة شهردأ
        endDate = startOfDay(addMonths(startDate, 3));
      }

      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const formattedEnd = format(addDays(endDate, -1), 'yyyy-MM-dd');
      periodLabel = `فترة مخصصة: ${formattedStart} ↔ ${formattedEnd}`;
    }

    return { startDate, endDate, periodLabel };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. getDashboardRegistry — الدالة الرئيسية الموحدة للوحة التحكم
  // ─────────────────────────────────────────────────────────────
  async getDashboardRegistry(
    managerId: string,
    mode: 'ALL' | 'daily' | 'weekly' | 'monthly',
    dateAnchor: string,
    page?: number,
    limit?: number,
    customStartDate?: string,
    customEndDate?: string,
  ): Promise<OptimizedDashboardResponse> {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerId },
    });

    if (!admin) {
      throw new NotFoundException('لم يتم العثور على حساب المدير');
    }

    // 1. حساب حدود الفترة الزمنية بدقة
    const result = this.calculateMonthlyBoundedPeriod(mode, dateAnchor, customStartDate, customEndDate);

    // 2. استعلام جلب المرؤوسين وسجلات حضورهم ضمن الفترة المحددة
    const subordinates = await this.prisma.employeeProfile.findMany({
      where: { managerId: admin.id },
      include: {
        user: {
          select: {
            fullName: true,
            jobTitle: true,
            imageProfile: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        shift: true,
        attendances: {
          where: {
            date: {
              gte: result.startDate,
              lt: result.endDate,
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    // 3. حساب سياق الوردية النشطة (activeShiftContext) ذو الأولوية
    let activeShiftContext = '';
    const contextFreq: Record<string, number> = {};
    for (const emp of subordinates) {
      const deptName = emp.department?.name || 'بدون قسم';
      const shiftName = emp.shift?.name || 'بدون وردية';
      const key = `${deptName} - ${shiftName}`;
      contextFreq[key] = (contextFreq[key] || 0) + 1;
    }
    let maxCount = 0;
    for (const [key, count] of Object.entries(contextFreq)) {
      if (count > maxCount) {
        maxCount = count;
        activeShiftContext = key;
      }
    }
    if (!activeShiftContext) {
      const firstDept = await this.prisma.department.findFirst({
        where: { managerId: admin.id },
        include: { shift: { take: 1 } },
      });
      if (firstDept) {
        const shiftName = firstDept.shift[0]?.name || '';
        activeShiftContext = shiftName ? `${firstDept.name} - ${shiftName}` : firstDept.name;
      } else {
        activeShiftContext = 'الإدارة العامة';
      }
    }

    // 4. حساب الإحصائيات وبناء جدول الموظفين
    const totalSubordinates = subordinates.length;
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let earlyDepartureCount = 0;
    let deductedCount = 0;

    
    const registry: RegistryEntry[] = [];
    
    for (const emp of subordinates) {
      const atts = emp.attendances;
      
      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let excusedDays = 0;
      let escapedDays = 0;
      let earlyDepartureDays = 0;
      let employeeDeductions = 0;

      const dailyBreakdown: DailyBreakdownEntry[] = [];
      
      for (const a of atts) {
        const status = a.status;
        if (status === AttendanceStatus.ON_TIME) {
          presentDays++;
        } else if (status === AttendanceStatus.LATE) {
          lateDays++;
          presentDays++;
          lateCount++;
        } else if (status === AttendanceStatus.ABSENT) {
          absentDays++;
        } else if (status === AttendanceStatus.EXCUSED) {
          excusedDays++;
        } else if (status === AttendanceStatus.ESCAPY) {
          escapedDays++;
        }

        if (status === AttendanceStatus.EXCUSED || a.isExcusedIn || a.isExcusedOut) {
          excusedCount++;
        }
        
        if ((a.earlyLeaveMinutes ?? 0) > 0) {
          earlyDepartureDays++;
          earlyDepartureCount++;
        }
        
        const dayDeduction = a.salaryDeduction ?? 0;
        employeeDeductions += dayDeduction;

        const excuseNotes = [a.excuseReasonIn, a.excuseReasonOut].filter(Boolean).join(' | ') || null;

        dailyBreakdown.push({
          date: format(toZonedTime(a.date, TZ), 'yyyy-MM-dd'),
          status: a.status,
          checkIn: a.checkIn ? a.checkIn.toISOString() : null,
          checkOut: a.checkOut ? a.checkOut.toISOString() : null,
          earlyLeaveMinutes: a.earlyLeaveMinutes ?? 0,
          dayDeduction,
          excuseNotes,
        });
      }

      if (presentDays > 0) {
        presentCount++;
      }

      // إصلاح Bug 2: عد الموظفين المخصوم منهم فعلياً بشكل فريد
      if (employeeDeductions > 0) {
        deductedCount++;
      }

      // في الوضع اليومي، إذا لم يتوفر سجل حضور للموظف، نعتبره غائباً لعرضه في الجدول
      if (mode === 'daily' && dailyBreakdown.length === 0) {
        absentDays++;
        dailyBreakdown.push({
          date: format(result.startDate, 'yyyy-MM-dd'),
          status: AttendanceStatus.ABSENT,
          checkIn: null,
          checkOut: null,
          earlyLeaveMinutes: 0,
          dayDeduction: 0,
          excuseNotes: null,
        });
      }

      // حساب التقييم
      const totalDays = presentDays + absentDays + excusedDays + escapedDays;
      const onTimeDays = presentDays - lateDays;
      const rate = totalDays > 0 ? Math.round((onTimeDays / totalDays) * 100) : 100;
      const disciplineRating = this.statsHelper.computeDisciplineRating(rate);

      registry.push({
        employeeId: emp.id,
        name: emp.user.fullName,
        role: emp.user.jobTitle || 'موظف',
        avatar: emp.user.imageProfile || '',
        disciplineRating,
        summary: {
          presentDays,
          absentDays,
          lateDays,
          totalDeductionsInPeriod: employeeDeductions,
        },
        dailyBreakdown,
      });
    }

    // 5. تطبيق الـ Pagination في الذاكرة لضمان سرعة الاستجابة ودقة العدادات الكلية
    const totalItems = registry.length;
    const currentLimit = limit || 10;
    const currentPage = page || 1;
    const totalPages = Math.ceil(totalItems / currentLimit);

    const paginatedRegistry = registry.slice((currentPage - 1) * currentLimit, currentPage * currentLimit);

    return {
      meta: {
        periodScope: {
          start: format(result.startDate, 'yyyy-MM-dd'),
          end: format(addDays(result.endDate, -1), 'yyyy-MM-dd'),
        },
        totalSubordinates: totalSubordinates,
        activeShiftContext: activeShiftContext,
        pagination: {
          page: currentPage,
          limit: currentLimit,
          totalItems: totalItems,
          totalPages: totalPages,
        },
      },
      aggregatedMetrics: {
        totalPresent: presentCount,
        totalLateOccurrences: lateCount,
        totalExcused: excusedCount,
        totalEarlyLeaves: earlyDepartureCount,
        totalDeductedEmployeesCount: deductedCount,
      },
      registry: paginatedRegistry,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // التقارير الأسبوعية والشهرية للموظفين
  // ─────────────────────────────────────────────────────────────

  async getWeeklyReport(userId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addDays(start, 7);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });

    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: user.employeeProfile.id,
        date: { gte: start, lt: end },
      },
      orderBy: { date: 'asc' },
    });

    const summaryResult = this.statsHelper.computePeriodSummary(attendances);

    return {
      summary: summaryResult.summary,
      records: summaryResult.records,
    };
  }

  async getAEmployeeWeeklyReport(employeeUserId: string, startDate: string) {
    return this.getWeeklyReport(employeeUserId, startDate);
  }

  async getMonthlyReport(userId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addMonths(start, 1);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });

    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: user.employeeProfile.id,
        date: { gte: start, lt: end },
      },
      orderBy: { date: 'asc' },
    });

    const summaryResult = this.statsHelper.computePeriodSummary(attendances);

    return {
      summary: summaryResult.summary,
      records: summaryResult.records,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // حالة الحضور اليومي للموظف
  // ─────────────────────────────────────────────────────────────
  async getTodayAttendanceStatus(userId: string) {
    const today = startOfDay(toZonedTime(Date.now(), TZ));

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: {
          include: {
            shift: true,
            attendances: { where: { date: today } },
          },
        },
      },
    });

    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const attendance = user.employeeProfile.attendances[0] || null;
    return {
      shift: user.employeeProfile.shift,
      attendance,
      checkedIn: !!attendance?.checkIn,
      checkedOut: !!attendance?.checkOut,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // البحث عن مستخدم
  // ─────────────────────────────────────────────────────────────
  async searchUsers(
    search: string,
    page: number = 1,
    limit: number = 10,
    roleFilter?: string,
    includeDiscipline: boolean = false,
  ) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };

      if (roleFilter && roleFilter !== 'all') {
        where.role = roleFilter;
      }

      const [results, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            adminProfile: true,
            employeeProfile: { include: { department: true, shift: true } },
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      let enrichedResults: any[] = results;
      if (includeDiscipline) {
        enrichedResults = await Promise.all(
          results.map(async (u) => {
            if (u.employeeProfile) {
              const enriched = await this.statsHelper.enrichEmployeeData(u.employeeProfile);
              return { ...u, employeeProfile: enriched };
            }
            return u;
          })
        );
      }

      return {
        data: enrichedResults,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (e) {
      throw new UnauthorizedException('حدث خطأ في البحث: ' + e?.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // automaticallyCheckOut - الانصراف التلقائي
  // ─────────────────────────────────────────────────────────────
  async automaticallyCheckOut(): Promise<{
    processed: number;
    results: { id: string; employeeProfileId: string; outcome: string }[];
    message: string;
  }> {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);
    const nowMinutes = nowZoned.getHours() * 60 + nowZoned.getMinutes();

    const openAttendances: any[] = await this.prisma.attendance.findMany({
      where: {
        date: today,
        checkOut: null,
        checkIn: { not: null },
      },
      include: {
        employeeProfile: {
          include: { shift: true },
        },
      },
    });

    if (openAttendances.length === 0) {
      return { processed: 0, results: [], message: 'لا توجد سجلات مفتوحة تحتاج إلى معالجة' };
    }

    const results: { id: string; employeeProfileId: string; outcome: string }[] = [];

    for (const attendance of openAttendances) {
      const shift = attendance.employeeProfile?.shift;
      if (!shift) continue;

      const [eh, em] = shift.endTime.split(':').map(Number);
      const shiftEndMinutes = eh * 60 + em;
      const shiftEndWithGrace = shiftEndMinutes + (shift.gracePeriodMinOut ?? 30);

      if (nowMinutes < shiftEndWithGrace) continue;

      const shiftEnd = setMilliseconds(
        setSeconds(setMinutes(setHours(nowZoned, eh), em), 0),
        0,
      );
      const totalWorked = Math.max(0, differenceInMinutes(shiftEnd, attendance.checkIn!));

      if (attendance.isExcusedOut) {
        await this.prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkOut: shiftEnd,
            totalWorkedMinutes: totalWorked,
            earlyLeaveMinutes: 0,
            adminNotes: [
              attendance.adminNotes,
              'خروج تلقائي - الموظف لديه عذر معتمد للخروج',
            ]
              .filter(Boolean)
              .join(' | '),
          },
        });
        results.push({
          id: attendance.id,
          employeeProfileId: attendance.employeeProfileId,
          outcome: 'EXCUSED_AUTO_OUT',
        });
      } else {
        await this.prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkOut: shiftEnd,
            totalWorkedMinutes: totalWorked,
            earlyLeaveMinutes: 0,
            status: AttendanceStatus.ESCAPY,
            adminNotes: 'خروج تلقائي - الموظف غادر دون تسجيل الانصراف',
          },
        });
        results.push({
          id: attendance.id,
          employeeProfileId: attendance.employeeProfileId,
          outcome: 'ESCAPY',
        });
      }
    }

    return {
      processed: results.length,
      results,
      message: `تمت معالجة ${results.length} سجل انصراف تلقائياً`,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // salaryDeductionDaily - خصم الراتب اليومي
  // ─────────────────────────────────────────────────────────────
  async salaryDeductionDaily(
    employeeId: string,
  ): Promise<{ deducted: number; newTotalDeduction: number; breakdown: Record<string, number> }> {
    const today = startOfDay(toZonedTime(Date.now(), TZ));

    const employee: any = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: {
        attendances: {
          where: { date: today },
        },
      },
    });

    if (!employee) throw new NotFoundException('لم يتم العثور على ملف الموظف');

    const todayAttendance = employee.attendances?.[0] ?? null;
    if (!todayAttendance) {
      return {
        deducted: 0,
        newTotalDeduction: 0,
        breakdown: { reason: 0 },
      };
    }

    const baseSalary: number = employee.salary ?? 0;
    const minuteRate = baseSalary / (22 * 8 * 60);
    const dailyRate = baseSalary / 22;

    const { status, isExcusedIn, isExcusedOut, delayMinutes, earlyLeaveMinutes } =
      todayAttendance;

    const breakdown: Record<string , number> = {};
    let todayDeduction = 0;

    if (!isExcusedIn && delayMinutes > 0) {
      breakdown.lateDeduction = Math.ceil(delayMinutes * minuteRate);
      todayDeduction += breakdown.lateDeduction;
    }

    if (!isExcusedOut && earlyLeaveMinutes > 0) {
      breakdown.earlyLeaveDeduction = Math.ceil(earlyLeaveMinutes * minuteRate);
      todayDeduction += breakdown.earlyLeaveDeduction;
    }

    if (status === AttendanceStatus.ESCAPY) {
      const escapyDeduction = Math.ceil(dailyRate);
      breakdown.escapyDeduction = escapyDeduction;
      todayDeduction = Math.max(todayDeduction, escapyDeduction);
    }

    if (todayDeduction === 0) {
      return {
        deducted: 0,
        newTotalDeduction: todayAttendance.salaryDeduction ?? 0,
        breakdown: { 'لا يوجد خصم مستحق لهذا اليوم': 0 },
      };
    }

    await this.prisma.attendance.update({
      where: { id: todayAttendance.id },
      data: { salaryDeduction: todayDeduction },
    });

    return {
      deducted: todayDeduction,
      newTotalDeduction: todayDeduction,
      breakdown,
    };
  }
}
