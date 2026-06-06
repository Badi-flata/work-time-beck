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
import { CalculatePeriodService } from './caculaePeriod.service';
import {
  OptimizedDashboardResponse,
  RegistryEntry,
  DailyBreakdownEntry,
  Modes,
} from './types/dashboard-registry.types';

const TZ = 'Asia/Riyadh';

@Injectable()
export class UtilitiesService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
    private calculatePeriod: CalculatePeriodService,
  ) {}

  
  
  // ─────────────────────────────────────────────────────────────
  // 2. getDashboardRegistry — الدالة الرئيسية الموحدة للوحة التحكم
  // ─────────────────────────────────────────────────────────────
  async getDashboardRegistry(
    managerId: string,
    mode: Modes,
    dateAnchor:string,
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
    
    // ─────────────────────────────────────────────────────────────
    // 1. calculateMonthlyBoundedPeriod — حساب الفترات الزمنية بدقة
    // ─────────────────────────────────────────────────────────────
    const result = this.calculatePeriod.calculateMonthlyBoundedPeriod(mode, dateAnchor, customStartDate, customEndDate);

    // 2. استعلام جلب المرؤوسين وسجلات حضورهم ضمن الفترة المحددة
    const subordinates = mode === Modes.DAILY ? await this.prisma.employeeProfile.findMany({
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
            date: result.startDate,
          },
          orderBy: { date: 'asc' },
        },
      },
    })
    : await this.prisma.employeeProfile.findMany({
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
    let absentCount = 0;
    let excusedCount = 0;
    let escapedCount = 0;
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
          presentDays++; // الموظف المتأخر يعتبر حاضراً مادياً
        } else if (status === AttendanceStatus.ABSENT) {
          absentDays++;
        }  else if (status === AttendanceStatus.ESCAPY) {
          escapedDays++;
        }
       else if (status === AttendanceStatus.EXCUSED || a.isExcusedIn || a.isExcusedOut) {
          excusedDays++;
        }
        
        if ((a.earlyLeaveMinutes ?? 0) > 0) {
          earlyDepartureDays++;
        }
        
        const dayDeduction = a.salaryDeduction ?? 0;
        employeeDeductions += dayDeduction;

        const excuseNotes = [a.excuseReasonIn, a.excuseReasonOut].filter(Boolean).join(' | ') || null;
        const checkIn = a.checkIn ? format(a.checkIn, "HH:mm") : null;
        const checkOut = a.checkOut ? format(a.checkOut, "HH:mm") : null;
        dailyBreakdown.push({
          date: format(toZonedTime(a.date, TZ), 'yyyy-MM-dd'),
          shift: emp.shift?.name || 'بدون وردية',
          status: a.status, 
          checkIn,
          checkOut,
          earlyLeaveMinutes: a.earlyLeaveMinutes ?? 0,
          dayDeduction,
          excuseNotes,
        });
      }

      // في الوضع اليومي، نعتبر الموظف غائباً فقط إذا لم يكن لديه سجل حضور وقد بدأ وقت ورديته (أو انتهت)
      const nowZoned = toZonedTime(Date.now(), TZ);
      const todayStr = format(nowZoned, 'yyyy-MM-dd');
      const anchorStr = format(result.startDate, 'yyyy-MM-dd');
      let isShiftActiveOrPast = false;
      if (anchorStr < todayStr) {
        isShiftActiveOrPast = true;
      } else if (anchorStr === todayStr) {
        const currentMinutes = nowZoned.getHours() * 60 + nowZoned.getMinutes();
        const [sh, sm] = emp.shift?.startTime.split(':').map(Number) || [0, 0];
        const shiftStartMinutes = sh * 60 + sm;
        if (currentMinutes >= shiftStartMinutes) {
          isShiftActiveOrPast = true;
        }
      }
      
      if (mode === Modes.DAILY && isShiftActiveOrPast && dailyBreakdown.length === 0) {
        absentDays++;
        dailyBreakdown.push({
          date: anchorStr,
          shift: emp.shift?.name || 'بدون وردية',
          status: AttendanceStatus.ABSENT,
          checkIn: null,
          checkOut: null,
          earlyLeaveMinutes: 0,
          dayDeduction: 0,
          excuseNotes: null,
        });
      }

      // حساب العدادات العلوية الفريدة لكل موظف للفترة
      if (presentDays > 0) {
        presentCount++;
      }
      if (absentDays > 0) {
        absentCount++;
      }
      if (excusedDays > 0) {
        excusedCount++;
      }
      if (lateDays > 0) {
        lateCount++;
      }
      if (escapedDays > 0) {
        escapedCount++;
      }
      if (earlyDepartureDays > 0) {
        earlyDepartureCount++;
      }
      if (employeeDeductions > 0) {
        deductedCount++;
      }

      // حساب التقييم
      const totalDays = presentDays + absentDays + excusedDays + escapedDays;
      const onTimeDays = presentDays - lateDays;
      const rate = totalDays > 0 ? Math.round((onTimeDays / totalDays) * 100) : 100;
      const disciplineRating = this.statsHelper.computeDisciplineRating(rate);

      registry.push({
        employeeId: emp.id,
        name: emp.user.fullName,
        avatar: emp.user.imageProfile || '',
        role: emp.user.jobTitle || 'موظف',
        disciplineRating,
        summary: {
          presentDays,
          absentDays,
          excusedDays,
          escapedDays,
          lateDays,
          earlyDepartureDays,
          totalDeductionsInPeriod: employeeDeductions,
        },
        dailyBreakdown,
      });
    }

    // 5. تطبيق الـ Pagination في الذاكرة لضمان سرعة الاستجابة ودقة العدادات الكلية
    const totalItems = registry.length;
    const currentLimit = limit || 5;
    const currentPage = page || 1;
    const totalPages = Math.ceil(totalItems / currentLimit);

    const paginatedRegistry = registry.slice((currentPage - 1) * currentLimit, currentPage * currentLimit);

    return {
      meta: {
        periodScope: result.periodLabel,
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
        totalAbsent: absentCount,
        totalEscaped: escapedCount,
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
