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
  DashboardRegistryResponse,
  DashboardMetrics,
} from './types/dashboard-registry.types';

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
  // 1. calculateMonthlyBoundedPeriod — حساب الفترات المقيدة بالشهر
  // ─────────────────────────────────────────────────────────────
  calculateMonthlyBoundedPeriod(mode: 'daily' | 'weekly' | 'monthly', dateAnchor: string) {
    const parsedDate = parseISO(dateAnchor);
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth(); // 0-indexed
    const day = parsedDate.getDate();

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (mode === 'daily') {
      startDate = startOfDay(parsedDate);
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
    } else {
      startDate = startOfMonth(parsedDate);
      endDate = startOfDay(addMonths(startDate, 1));
      
      const formattedStart = format(startDate, 'yyyy-MM-dd');
      const lastDayOfMonth = endOfMonth(parsedDate);
      const formattedEnd = format(lastDayOfMonth, 'yyyy-MM-dd');
      periodLabel = `شهر ${format(startDate, 'yyyy-MM')}: ${formattedStart} ↔ ${formattedEnd}`;
    }

    return { startDate, endDate, periodLabel };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. getDashboardRegistry — الدالة الرئيسية الموحدة للوحة التحكم
  // ─────────────────────────────────────────────────────────────
  async getDashboardRegistry(
    managerId: string,
    mode: 'daily' | 'weekly' | 'monthly',
    dateAnchor: string,
  ): Promise<DashboardRegistryResponse> {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerId },
    });

    if (!admin) {
      throw new NotFoundException('لم يتم العثور على حساب المدير');
    }

    // 1. حساب حدود الفترة الزمنية
    const { startDate, endDate, periodLabel } = this.calculateMonthlyBoundedPeriod(mode, dateAnchor);

    // 2. استعلام جلب المرؤوسين وسجلات حضورهم ضمن الفترة المحددة
    const subordinates = await this.prisma.employeeProfile.findMany({
      where: { managerId: admin.id },
      include: {
        user: {
          select: {
            fullName: true,
            jobTitle: true,
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
              gte: startDate,
              lt: endDate,
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    // 3. حساب الإحصائيات العلوية (metrics)
    const totalEmployees = subordinates.length;
    let presentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let earlyDepartureCount = 0;
    let deductedCount = 0;

    const tableRows: any[] = [];

    for (const emp of subordinates) {
      const atts = emp.attendances;

      // أ) حساب الحاضرين الفريدين
      const hasPresentRecord = atts.some(
        (a) => a.checkIn && a.status !== AttendanceStatus.ABSENT,
      );
      if (hasPresentRecord) {
        presentCount++;
      }

      // حساب عدادات التأخير، الأعذار، الخروج المبكر
      atts.forEach((a) => {
        if (a.status === AttendanceStatus.LATE) {
          lateCount++;
        }
        if (a.status === AttendanceStatus.EXCUSED || a.isExcusedIn || a.isExcusedOut) {
          excusedCount++;
        }
        if ((a.earlyLeaveMinutes ?? 0) > 0) {
          earlyDepartureCount++;
        }
      });

      // حساب الخصومات للفترة
      let hasPeriodDeductionOffense = false;
      let periodTotalDeductions = 0;

      atts.forEach((a) => {
        const dailyDeduction = this.statsHelper.computeDailyDeduction(a, emp.salary ?? 0);
        if (dailyDeduction > 0) {
          periodTotalDeductions += dailyDeduction;
          hasPeriodDeductionOffense = true;
        }
      });

      if (hasPeriodDeductionOffense) {
        deductedCount++;
      }

      // ب) بناء الصفوف متعددة الأشكال (Polymorphic Table Rows)
      if (mode === 'daily') {
        const att = atts[0] ?? null;
        const dailyDeduction = att ? this.statsHelper.computeDailyDeduction(att, emp.salary ?? 0) : 0;

        tableRows.push({
          employeeProfileId: emp.id,
          fullName: emp.user.fullName,                                      // أولوية 1
          status: att?.status ?? 'ABSENT',                                  // أولوية 2
          checkIn: att?.checkIn ?? null,                                    // أولوية 3
          checkOut: att?.checkOut ?? null,                                  // أولوية 4
          todayDeduction: dailyDeduction,                                   // أولوية 5
          jobTitle: emp.user.jobTitle,
          departmentName: emp.department.name,
          shiftHours: `${emp.shift.startTime} - ${emp.shift.endTime}`,
          isExcusedIn: att?.isExcusedIn ?? false,
          isExcusedOut: att?.isExcusedOut ?? false,
          excuseReasonIn: att?.excuseReasonIn ?? null,
          excuseReasonOut: att?.excuseReasonOut ?? null,
        });
      } else {
        // weekly | monthly mode
        const summary = this.statsHelper.summarizeAttendances(atts);
        const disciplineRate =
          summary.totalDays > 0
            ? Math.round((summary.onTimeDays / summary.totalDays) * 100)
            : 100;
        
        tableRows.push({
          employeeProfileId: emp.id,
          fullName: emp.user.fullName,                                      // أولوية 1
          disciplineRate,                                                   // أولوية 2
          disciplineLabel: this.statsHelper.computeDisciplineLabel(disciplineRate), // أولوية 3
          periodDeductions: periodTotalDeductions,                          // أولوية 4
          presentDays: summary.presentDays,
          absentDays: summary.absentDays,
          lateDays: summary.lateDays,
          earlyDepartureCount: summary.earlyDepartureCount,
          jobTitle: emp.user.jobTitle,
          departmentName: emp.department.name,
        });
      }
    }

    const metrics: DashboardMetrics = {
      mode,
      periodLabel,
      totalEmployees,
      presentCount,
      lateCount,
      excusedCount,
      earlyDepartureCount,
      deductedCount,
    };

    return {
      metrics,
      table: tableRows,
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
