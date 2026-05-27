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
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { AttendanceStatus } from '@prisma/client';
import { StatisticsHelperService } from './statistics-helper.service';

const TZ = 'Asia/Riyadh';

@Injectable()
export class UtilitiesService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // GET /managing/dashboard?date=2026-05-18&status=LATE
  // ─────────────────────────────────────────────────────────────
  async getDashboard(managerId: string, date: string, statusFilter?: string) {
    const targetDate = startOfDay(parseISO(date));

    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerId },
      include: {
        subordinates: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
              },
            },
            attendances: {
              where: { date: targetDate },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('لم يتم العثور على حساب المدير');
    }

    const stats = this.statsHelper.computeDashboardStats(admin.subordinates);

    let filteredList: any[] | undefined = undefined;
    if (statusFilter && statusFilter !== 'all') {
      const key = statusFilter.toLowerCase();
      const mapping: Record<string, string> = {
        present: 'present',
        absent: 'absent',
        excused: 'excused',
        escaped: 'escaped',
        late: 'late',
        ontime: 'onTime',
      };
      const actualKey = mapping[key] || statusFilter;
      filteredList = stats.details[actualKey] || [];
    }

    return {
      counts: stats.counts,
      details: stats.details,
      ...(filteredList !== undefined && { filteredList }),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GET /managing/daily-report
  // ─────────────────────────────────────────────────────────────
  async getDailyReport(managerId: string, date?: string) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    const targetDateStr = date || defaultDate;
    const targetDate = startOfDay(parseISO(targetDateStr));

    // 1. Get dashboard stats for today
    const dashboardStats = await this.getDashboard(managerId, targetDateStr);

    const total = dashboardStats.counts.total;
    const onTime = dashboardStats.counts.onTime;

    // 2. Compute team discipline rate
    const teamDisciplineRate = total > 0 ? Math.round((onTime / total) * 100) : 100;

    let teamDisciplineLabel: string;
    if (teamDisciplineRate >= 95) teamDisciplineLabel = 'ممتاز';
    else if (teamDisciplineRate >= 85) teamDisciplineLabel = 'جيد جداً';
    else if (teamDisciplineRate >= 70) teamDisciplineLabel = 'جيد';
    else teamDisciplineLabel = 'يحتاج تحسين';

    // 3. Find top disciplined employees & attendance log
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerId },
      include: {
        subordinates: {
          include: {
            user: {
              select: { fullName: true, id: true },
            },
            attendances: {
              where: { date: targetDate },
            },
          },
        },
      },
    });

    const topDisciplined: any[] = [];
    let todayAttendanceLog: any[] = [];

    if (admin) {
      const employeesWithDiscipline = await Promise.all(
        admin.subordinates.map(async (sub) => {
          const rateObj = await this.statsHelper.computeDisciplineRate(sub.id, 30);
          return {
            id: sub.id,
            fullName: sub.user.fullName,
            rate: rateObj.rate,
            label: rateObj.label,
          };
        }),
      );

      employeesWithDiscipline.sort((a, b) => b.rate - a.rate);
      topDisciplined.push(...employeesWithDiscipline.slice(0, 5));

      todayAttendanceLog = admin.subordinates.map((sub) => {
        const att = sub.attendances?.[0];
        return {
          id: sub.id,
          fullName: sub.user.fullName,
          checkIn: att?.checkIn || null,
          checkOut: att?.checkOut || null,
          status: att?.status || 'ABSENT',
        };
      });
    }

    // 4. Chart data: percentages
    const chartData = {
      present: total > 0 ? Math.round((dashboardStats.counts.present / total) * 100) : 0,
      absent: total > 0 ? Math.round((dashboardStats.counts.absent / total) * 100) : 0,
      late: total > 0 ? Math.round((dashboardStats.counts.late / total) * 100) : 0,
      excused: total > 0 ? Math.round((dashboardStats.counts.excused / total) * 100) : 0,
    };

    return {
      dashboardStats,
      teamDisciplineRate,
      teamDisciplineLabel,
      topDisciplined,
      chartData,
      todayAttendanceLog,
    };
  }



  // ─────────────────────────────────────────────────────────────
  // التقارير الأسبوعية والشهرية
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

  async latestWeekReport(managerUserId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addDays(start, 7);

    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
      include: {
        subordinates: {
          include: {
            user: {
              select: { fullName: true, email: true, phone: true },
            },
            attendances: {
              where: { date: { gte: start, lt: end } },
              orderBy: { date: 'asc' },
            },
          },
        },
      },
    });

    if (!admin) throw new NotFoundException('لم يتم العثور على حساب المدير');

    return admin.subordinates.map((sub: any) => {
      const summaryResult = this.statsHelper.computePeriodSummary(sub.attendances);
      return {
        ...sub,
        periodSummary: summaryResult.summary,
      };
    });
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

  async latestMonthReport(managerUserId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addMonths(start, 1);

    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
      include: {
        subordinates: {
          include: {
            user: {
              select: { fullName: true, email: true, phone: true },
            },
            attendances: {
              where: { date: { gte: start, lt: end } },
              orderBy: { date: 'asc' },
            },
          },
        },
      },
    });

    if (!admin) throw new NotFoundException('لم يتم العثور على حساب المدير');

    return admin.subordinates.map((sub: any) => {
      const summaryResult = this.statsHelper.computePeriodSummary(sub.attendances);
      return {
        ...sub,
        periodSummary: summaryResult.summary,
      };
    });
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
  // automaticallyCheckOut - الانصراف التلقائي (Cron Job)
  //
  // الخوارزم:
  //  1. جلب جميع سجلات الحضور المفتوحة (checkOut = null) لليوم الحالي
  //  2. فلترة من تجاوزت وردياتهم + gracePeriodMinOut الخاصة بكل موظف
  //  3. لكل موظف مؤهل:
  //     أ) إن كان لديه عذر (isExcusedOut = true):
  //        → checkOut = نهاية الوردية، الحفاظ على الحالة السابقة
  //     ب) إن لم يكن له عذر:
  //        → checkOut = نهاية الوردية، status = ESCAPY (هرب بدون إذن)
  //  4. يُعيد قائمة بمعرفات الموظفين المتأثرين ليُشغَّل خصم الراتب عليهم
  // ─────────────────────────────────────────────────────────────
  async automaticallyCheckOut(): Promise<{
    processed: number;
    results: { id: string; employeeProfileId: string; outcome: string }[];
    message: string;
  }> {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);
    const nowMinutes = nowZoned.getHours() * 60 + nowZoned.getMinutes();

    // 1. جلب كل سجلات الحضور المفتوحة لليوم مع بيانات الوردية
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

      // 2. تحقق من انتهاء وردية الموظف + gracePeriodMinOut
      const [eh, em] = shift.endTime.split(':').map(Number);
      const shiftEndMinutes = eh * 60 + em;
      const shiftEndWithGrace = shiftEndMinutes + (shift.gracePeriodMinOut ?? 30);

      // تخطي من لم تنته وردياتهم + فترة السماح بعد
      if (nowMinutes < shiftEndWithGrace) continue;

      // 3. وقت نهاية الوردية يُستخدم كوقت الخروج المرجعي (أدق من الوقت الحالي)
      const shiftEnd = setMilliseconds(
        setSeconds(setMinutes(setHours(nowZoned, eh), em), 0),
        0,
      );
      const totalWorked = Math.max(0, differenceInMinutes(shiftEnd, attendance.checkIn!));

      if (attendance.isExcusedOut) {
        // 3أ. معذور للخروج: خروج طبيعي عند نهاية الوردية مع الحفاظ على الحالة الأصلية
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
        // 3ب. غير معذور: ESCAPY - غادر دون تسجيل الانصراف
        await this.prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkOut: shiftEnd,
            totalWorkedMinutes: totalWorked,
            earlyLeaveMinutes: 0, // لا نعرف متى غادر فعلاً، الحالة ESCAPY تعبّر عن المخالفة
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
  // salaryDeductionDaily - خصم الراتب اليومي (Cron Job أو نقطة نهاية للمدير)
  //
  // الخوارزم:
  //  المعدل الساعي = الراتب الشهري ÷ (22 يوم عمل × 8 ساعات) = salary ÷ 176
  //  المعدل الدقيقي = المعدل الساعي ÷ 60
  //
  //  1. التأخر دون عذر   → خصم = delayMinutes × المعدل الدقيقي
  //  2. المغادرة المبكرة دون عذر → خصم = earlyLeaveMinutes × المعدل الدقيقي
  //  3. ESCAPY (هرب)     → خصم يوم كامل = salary ÷ 22
  //     يُطبَّق الأكبر بين حسابَي التأخر/المغادرة وخصم اليوم الكامل
  //
  //  الخصم يُجمع على salaryDeduction التراكمية دون المساس بـ salary الأساسي
  //  (صافي الراتب = salary - salaryDeduction يُحسب عند الصرف)
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

    // لا يوجد سجل حضور لليوم → لا خصم (الغياب يُعالَج بشكل مستقل)
    const todayAttendance = employee.attendances?.[0] ?? null;
    if (!todayAttendance) {
      return {
        deducted: 0,
        newTotalDeduction: employee.salaryDeduction ?? 0,
        breakdown: { reason: 0 },
      };
    }

    const baseSalary: number = employee.salary ?? 0;
    // المعدل الدقيقي: الراتب ÷ (22 يوم × 8 ساعات × 60 دقيقة) = salary ÷ 10560
    const minuteRate = baseSalary / (22 * 8 * 60);
    // معدل اليوم الكامل: الراتب ÷ 22 يوم عمل
    const dailyRate = baseSalary / 22;

    const { status, isExcusedIn, isExcusedOut, delayMinutes, earlyLeaveMinutes } =
      todayAttendance;

    const breakdown: Record<string , number> = {};
    let todayDeduction = 0;

    // 1. خصم التأخر في الحضور (بدون عذر)
    if (!isExcusedIn && delayMinutes > 0) {
      breakdown.lateDeduction = Math.ceil(delayMinutes * minuteRate);
      todayDeduction += breakdown.lateDeduction;
    }

    // 2. خصم المغادرة المبكرة (بدون عذر)
    if (!isExcusedOut && earlyLeaveMinutes > 0) {
      breakdown.earlyLeaveDeduction = Math.ceil(earlyLeaveMinutes * minuteRate);
      todayDeduction += breakdown.earlyLeaveDeduction;
    }

    // 3. ESCAPY: خصم يوم كامل، نأخذ الأعلى بين الخصوم المحسوبة وخصم اليوم
    if (status === AttendanceStatus.ESCAPY) {
      const escapyDeduction = Math.ceil(dailyRate);
      breakdown.escapyDeduction = escapyDeduction;
      // يُطبَّق الأكبر لضمان عقوبة كاملة دون مضاعفة
      todayDeduction = Math.max(todayDeduction, escapyDeduction);
    }

    if (todayDeduction === 0) {
      return {
        deducted: 0,
        newTotalDeduction: employee.salaryDeduction ?? 0,
        breakdown: { 'لا يوجد خصم مستحق لهذا اليوم': 0 },
      };
    }

    // تجميع الخصم التراكمي على salaryDeduction (لا يُمسّ salary الأساسي)
    const currentDeduction: number = employee.salaryDeduction ?? 0;
    const newTotalDeduction = currentDeduction + todayDeduction;

    await this.prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { salaryDeduction: newTotalDeduction },
    });

    return {
      deducted: todayDeduction,
      newTotalDeduction,
      breakdown,
    };
  }
}
