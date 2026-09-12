import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from './../prisma/prisma.service';
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
  differenceInHours,
  startOfWeek,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { randomUUID } from 'crypto';
import { AttendanceStatus, ExcuseType, Role } from '@prisma/client';
import { StatisticsHelperService } from './statistics-helper.service';
import { CalculatePeriodService } from './calculate-period.service';
import {
  OptimizedDashboardResponse,
  RegistryEntry,
  DailyBreakdownEntry,
  Modes,
} from './types/dashboard-registry.types';
import { ResponseHelper } from '../core/helpers/response.helper';
import { ManagerProfileNotFoundException } from '../core/domain-exceptions/department.exceptions';
import { EmployeeProfileNotFoundException } from '../core/domain-exceptions/employee.exceptions';
import { AttendanceRecordsNotFoundException } from '../core/domain-exceptions/utility.exceptions';

const TZ = 'Asia/Riyadh';

@Injectable()
export class UtilitiesService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
    private calculatePeriod: CalculatePeriodService,
  ) { }



  // ─────────────────────────────────────────────────────────────
  // 2. getDashboardRegistry — الدالة الرئيسية الموحدة للوحة التحكم
  // ─────────────────────────────────────────────────────────────
  async getDashboardRegistry(
    managerId: string,
    mode: Modes,
    dateAnchor: string,
    page?: number,
    limit?: number,
    customStartDate?: string,
    customEndDate?: string,
    status?: string,
    excludeBreakdown?: boolean,
  ): Promise<OptimizedDashboardResponse> {
    const admin = await this.prisma.adminProfile.findFirst({
      where: { OR: [{ userId: managerId }, { id: managerId }] },
      include:{managedDepartments:true}
    });

    if (!admin) {
      throw new ManagerProfileNotFoundException();
    }

    // ─────────────────────────────────────────────────────────────
    // 1. calculateMonthlyBoundedPeriod — حساب الفترات الزمنية بدقة
    // ─────────────────────────────────────────────────────────────
    const result = this.calculatePeriod.calculateMonthlyBoundedPeriod(mode, dateAnchor, customStartDate, customEndDate);
    const expectedWorkingDays = this.statsHelper.calculateExpectedWorkingDays(result.startDate , result.endDate ,{
      department:{
        weekendDays:admin.managedDepartments[0].weekendDays as [number,number],
        workingDays:admin.managedDepartments[0].monthlyWorkingDays as number,
      }
    });


    // 2. استعلام جلب المرؤوسين وسجلات حضورهم ضمن الفترة المحددة
    const subordinates = mode === Modes.DAILY ? await this.prisma.employeeProfile.findMany({
      where: { OR: [{ managerId: admin.id }, { department: { managerId: admin.id } }] },
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
          include: { excuses: true },
          orderBy: { date: 'asc' },
        },
      },
    })
      : await this.prisma.employeeProfile.findMany({
        where: { OR: [{ managerId: admin.id }, { department: { managerId: admin.id } }] },
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
            include: { excuses: true },
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
    let globalRating = 0;

    const registry: RegistryEntry[] = [];

    for (const emp of subordinates) {
      const {attendances:atts , shift ,department ,user } = emp;
      const dailyBreakdown: DailyBreakdownEntry[] = [];
      const { summary, days ,rate, label } = this.statsHelper.summarizeAttendances(atts,expectedWorkingDays);

      dailyBreakdown.push(...days);

      // في الوضع اليومي، نعتبر الموظف غائباً فقط إذا لم يكن لديه سجل حضور وقد بدأ وقت ورديته (أو انتهت)
      const nowZoned = toZonedTime(Date.now(), TZ);
      const todayStr = format(nowZoned, 'yyyy-MM-dd');
      const anchorStr = format(result.startDate, 'yyyy-MM-dd');
      let isShiftActiveOrPast = false;
      if (anchorStr < todayStr) {
        isShiftActiveOrPast = true;
      } else if (anchorStr === todayStr) {
        const currentMinutes = nowZoned.getHours() * 60 + nowZoned.getMinutes();
        const [sh, sm] = emp.shift?.startTime?.split(':').map(Number) || [0, 0];
        const shiftStartMinutes = sh * 60 + sm;
        if (currentMinutes >= shiftStartMinutes) {
          isShiftActiveOrPast = true;
        }
      }

      if (mode === Modes.DAILY && isShiftActiveOrPast && dailyBreakdown.length === 0) {
        summary.absentDays += 1;
        summary.totalDays += 1;
        dailyBreakdown.push({
          attendanceId:`${user.fullName}-${AttendanceStatus.ABSENT}-${summary.absentDays}-${anchorStr}`,
          date: anchorStr,
          status: AttendanceStatus.ABSENT,
          managerName: shift?.managerName || 'بدون مدير',
          departmentName: department?.name || 'بدون قسم',
          checkIn: null,
          checkOut: null,
          shiftName:shift?.name || 'بدون وردية',
          shiftStart: shift?.startTime || 'بدون وردية',
          shiftEnd: shift?.endTime || 'بدون وردية',
          graceIn: shift?.gracePeriodMinIn || 15,
          graceOut: shift?.gracePeriodMinOut || 30,
          totalWorkedHours: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          deduction: 0,
          excuses: [],
        });
      }

      // حساب العدادات العلوية الفريدة لكل موظف للفترة
      if (summary.presentDays > 0) {
        presentCount++;
      }
      if (summary.absentDays > 0) {
        absentCount++;
      }
      if (summary.excusedDays > 0) {
        excusedCount++;
      }
      if (summary.lateDays > 0) {
        lateCount++;
      }
      if (summary.escapedDays > 0) {
        escapedCount++;
      }
      if (summary.earlyDepartureDays > 0) {
        earlyDepartureCount++;
      }
      if (summary.deductionDays > 0) {
        deductedCount++;
      }

      // حساب التقييم
      globalRating += rate;

      registry.push({
        employeeId: emp.userId,
        name: emp.user.fullName,
        avatar: emp.user.imageProfile || '',
        jobTitle: emp.user.jobTitle   || 'موظف',
        rate:rate,
        isWorking:emp.isWorking,
        disciplineRating:label,
        summary: {
          ...summary,
        },
        dailyBreakdown,
      });
    }

    // count Global Rating
    const ratingOrganization = totalSubordinates > 0 ? Math.round(globalRating / totalSubordinates) : 0;
    const organizationLabel = this.statsHelper.computeDisciplineRating(ratingOrganization);

    // Apply filtering by status if requested
    let filteredRegistry = registry;
    if (status) {

      const s = status.toUpperCase();
      switch (s) {
        case 'ON_TIME':
          filteredRegistry = registry.filter(e => e.summary.presentDays > 0);
          break;
        case 'LATE':
          filteredRegistry = registry.filter(e => e.summary.lateDays > 0);
          break;
        case 'ABSENT':
          filteredRegistry = registry.filter(e => e.summary.absentDays > 0);
          break;
        case 'EXCUSED':
          filteredRegistry = registry.filter(e => e.summary.excusedDays > 0);
          break;
        case 'DEDUCTED':
          filteredRegistry = registry.filter(e => e.summary.totalDeductions > 0);
          break;
        case 'ESCAPY':
          filteredRegistry = registry.filter(e => e.summary.escapedDays > 0);
          break;
        case 'EARLY_LEAVE':
          filteredRegistry = registry.filter(e => e.summary.earlyDepartureDays > 0);
          break;
      }
    }

    if (excludeBreakdown) {
      filteredRegistry = filteredRegistry.map(e => ({
        ...e,
        dailyBreakdown: [],
      }));
    }

    // 5. تطبيق الـ Pagination في الذاكرة لضمان سرعة الاستجابة ودقة العدادات الكلية
    const totalItems = filteredRegistry.length;
    const currentLimit = limit || 5;
    const currentPage = page || 1;
    const totalPages = Math.ceil(totalItems / currentLimit);

    const paginatedRegistry = filteredRegistry.slice((currentPage - 1) * currentLimit, currentPage * currentLimit);

    return {
      meta: {
        RatingOrginzation: ratingOrganization,
        OrginzationLabel: organizationLabel,
        organizationRating: ratingOrganization,
        organizationLabel: organizationLabel,
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
  // التقارير  الأسبوعية والشهرية للموظفين 
  // ─────────────────────────────────────────────────────────────

  async fetchPeriodReport(userId: string, startDate: string , mode: Modes, employeeId?: string ) {
    const { periodLabel , startDate:start , endDate:end } = this.calculatePeriod.calculateMonthlyBoundedPeriod( mode , startDate )

    let targetProfileId= employeeId || userId;

      const user = await this.prisma.employeeProfile.findFirst({
        where: {OR:[ {id: targetProfileId } , {userId:targetProfileId}]}, 
        include: { department: true },
      });

      if (!user ) {
        throw new EmployeeProfileNotFoundException();
      }
  
    const expectedWorkingDays = this.statsHelper.calculateExpectedWorkingDays(start, end ,{
      department:{
        weekendDays:user.department?.weekendDays as [number,number],
        workingDays:user.department?.monthlyWorkingDays as number,
      }
    });

    const attendances = mode === Modes.DAILY ?
    await this.prisma.attendance.findFirst({
      where: {
        employeeProfileId: user.id,
        date: { gte: start, lt: end },
      },
      include:{
        excuses:{
          select:{
            type:true,
            reason:true,
            isApproved:true
          }
        }
      }
    }) 
      :
      await this.prisma.attendance.findMany({
      where: {
        employeeProfileId : user.id,
        date: { gte: start, lt: end },
      },
        include:{
        excuses:{
          select:{
            type:true,
            reason:true,
            isApproved:true
          }
        }
      },
      orderBy: { date: 'asc' },
    });
  
    const recordsList = Array.isArray(attendances) 
      ? attendances 
      : (attendances ? [attendances] : []);

    if (recordsList.length === 0) {
      throw new AttendanceRecordsNotFoundException(startDate, mode);
    }

    const { summary, days, label, rate } = this.statsHelper.summarizeAttendances(
      recordsList, 
      mode === Modes.DAILY ? 1 : expectedWorkingDays
    );

    return {
      periodLabel,
      rate,
      label,
      summary,
      records: days,
    };
  }
 
  // ─────────────────────────────────────────────────────────────
  // automaticallyCheck - التحقق التلقائي للغياب والانصراف
  // ─────────────────────────────────────────────────────────────
  async automaticallyCheck(userId: string, isForce: boolean = false): Promise<{
    processed: number;
    results: { id: string; employeeProfileId: string; outcome: string; details?: string }[];
    message: string;
  }>
   {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);
    const nowMinutes = nowZoned.getHours() * 60 + nowZoned.getMinutes();
    const dayOfWeek = nowZoned.getDay();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    const admin = user?.adminProfile || await this.prisma.adminProfile.findFirst({
      where: {
        OR: [
          { userId },
          { id: userId },
        ],
      },
    });

    // إذا كان المدير معطلاً للانصراف التلقائي
    if (admin && admin.autoCheckoutEnabled === false && !isForce) {
      return {
        processed: 0,
        results: [],
        message: 'الانصراف التلقائي معطل حالياً في إعدادات المدير.',
      };
    }

    const todayStr = format(nowZoned, 'yyyy-MM-dd');
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

    // تاريخ الأمس للورديات العابرة لمنتصف الليل أو الحضور المفتوح
    const yesterdayDateObj = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = format(toZonedTime(yesterdayDateObj, TZ), 'yyyy-MM-dd');
    const yesterdayDate = new Date(`${yesterdayStr}T00:00:00.000Z`);

    // إعداد شرط استعلام الموظفين التابعين للمدير أو للنظام بالكامل إذا كان سوبر أدمن
    let whereClause: any = {};
    if (user?.role === Role.SUPER_ADMIN && !admin) {
      whereClause = {};
    } else {
      const managerIds = [userId];
      if (admin?.userId && !managerIds.includes(admin.userId)) managerIds.push(admin.userId);
      if (admin?.id && !managerIds.includes(admin.id)) managerIds.push(admin.id);

      whereClause = {
        OR: [
          { managerId: { in: managerIds } },
          { department: { managerId: { in: managerIds } } },
          { department: { manager: { userId: { in: managerIds } } } },
        ],
      };
    }

    const employees = await this.prisma.employeeProfile.findMany({
      where: whereClause,
      include: {
        manager: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
        shift: true,
        department: {
          include: {
            shift: true,
          },
        },
        attendances: {
          where: {
            OR: [
              { date: todayDate },
              { date: today },
              { date: yesterdayDate },
              { checkIn: { not: null }, checkOut: null },
            ],
          },
          orderBy: { date: 'desc' },
          include: { excuses: true },
        },
      },
    });

    const results: { id: string; employeeProfileId: string; outcome: string; details?: string }[] = [];

    for (const employee of employees) {
      // 1. تحديد أي سجل حضور مفتوح (سجل دخول ولم يسجل خروج)
      const openAttendance = employee.attendances.find((a) => a.checkIn && !a.checkOut);

      // 2. فحص هل يوجد سجل حضور مسجل لليوم
      const todayAttendance = employee.attendances.find((a) => {
        const dStr = format(new Date(a.date), 'yyyy-MM-dd');
        return dStr === todayStr;
      });

      // 3. تحديد الوردية المعمول بها:
      let shift = employee.shift;
      const targetShiftId = openAttendance?.shiftId || todayAttendance?.shiftId;
      if (targetShiftId && targetShiftId !== shift?.id) {
        const recordedShift = await this.prisma.shift.findUnique({
          where: { id: targetShiftId },
        });
        if (recordedShift) {
          shift = recordedShift;
        }
      }

      if (!shift && employee.department?.shift && employee.department.shift.length > 0) {
        shift = employee.department.shift[0];
      }

      if (!shift || !shift.startTime || !shift.endTime) continue;

      const [sh, sm] = shift.startTime.split(':').map(Number);
      const shiftStartMinutes = sh * 60 + sm;
      const [eh, em] = shift.endTime.split(':').map(Number);
      const shiftEndMinutes = eh * 60 + em;
      const isCrossDay = shiftEndMinutes < shiftStartMinutes;
      const gracePeriodMinOut = shift.gracePeriodMinOut ?? 30;
      const gracePeriodMinIn = shift.gracePeriodMinIn ?? 15;
      const shiftEndWithGrace = shiftEndMinutes + gracePeriodMinOut;

      // ─── الحالة الأولى: الموظف لديه سجل حضور مفتوح (سجل دخول ولم يسجل خروج) ───
      if (openAttendance) {
        const attendance = openAttendance;
        const attDateStr = format(new Date(attendance.date), 'yyyy-MM-dd');
        const isPastDayAttendance = attDateStr < todayStr;

        // التحقق من انتهاء الوردية:
        let isShiftEnded = isPastDayAttendance;
        if (!isShiftEnded) {
          if (isCrossDay) {
            isShiftEnded = (nowMinutes >= shiftEndWithGrace && nowMinutes < shiftStartMinutes);
          } else {
            isShiftEnded = nowMinutes >= shiftEndWithGrace;
          }
        }

        // في حال تشغيل الفحص الإجباري (Force) أو انتهاء وقت الوردية
        if (isShiftEnded || isForce) {
          const attDate = attendance.date ? new Date(attendance.date) : nowZoned;
          const attDateZoned = toZonedTime(attDate, TZ);
          let shiftEnd = setMilliseconds(
            setSeconds(setMinutes(setHours(attDateZoned, eh), em), 0),
            0,
          );
          if (isCrossDay) {
            shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
          }

          const totalWorked = Math.max(0, differenceInHours(shiftEnd, attendance.checkIn!));

          const hasApprovedExcuseOut = attendance.excuses?.some(
            (exc: any) => exc.isApproved && exc.type === ExcuseType.EARLY_DEPARTURE,
          );

          if (hasApprovedExcuseOut || (attendance as any).isExcusedOut) {
            await this.prisma.attendance.update({
              where: { id: attendance.id },
              data: {
                checkOut: shiftEnd,
                totalWorkedHours: totalWorked,
                earlyLeaveMinutes: 0,
               
                adminNotes: [
                  attendance.adminNotes,
                  'خروج تلقائي - الموظف لديه عذر معتمد للخروج',
                ]
                  .filter(Boolean)
                  .join(' | '),
              },
            });
            await this.prisma.employeeProfile.update({
              where: { id: employee.id },
              data: { isWorking: false },
            });
            results.push({
              id: attendance.id,
              employeeProfileId: employee.id,
              outcome: 'EXCUSED_AUTO_OUT',
              details: `تم الانصراف التلقائي بعذر معتمد للموظف (${totalWorked} ساعة عمل)`,
            });
          } else {
            const shiftDurationMinutes = isCrossDay
              ? (24 * 60 - shiftStartMinutes + shiftEndMinutes)
              : (shiftEndMinutes - shiftStartMinutes);
            const shiftHours = shiftDurationMinutes / 60;
            const defaultEscapyWorkedHours = Math.max(0, Math.round((shiftHours / 2) * 10) / 10);
            const escapyEarlyLeaveMinutes = Math.round(shiftDurationMinutes / 2);

            await this.prisma.attendance.update({
              where: { id: attendance.id },
              data: {
                checkOut: shiftEnd,
                totalWorkedHours: defaultEscapyWorkedHours,
                earlyLeaveMinutes: escapyEarlyLeaveMinutes,
                status: AttendanceStatus.ESCAPY,
                adminNotes: 'خروج تلقائي - مغادر دون إذن بالانصراف (احتساب نصف ساعات الوردية افتراضياً)',
              },
            });
            await this.prisma.employeeProfile.update({
              where: { id: employee.id },
              data: { isWorking: false },
            });

            // تطبيق الخصم اليومي عند الانصراف التلقائي
            const adminPrefs = admin || {
              autoCheckoutEnabled: true,
              isActiveDeduction: false,
              earlyLeaveDeductionEnabled: true,
              combineDeductionsOnEndShift: true,
              delayDeductionEnabled: true,
              absentDeductionEnabled: true,
            };

            if (adminPrefs.isActiveDeduction && adminPrefs.earlyLeaveDeductionEnabled) {
              await this.salaryDeductionDaily(employee.id, adminPrefs, attendance.id);
            }

            results.push({
              id: attendance.id,
              employeeProfileId: employee.id,
              outcome: 'ESCAPY',
              details: `خروج تلقائي (مغادرة دون إذن) واحتساب ${defaultEscapyWorkedHours} ساعة والخصم المترتب`,
            });
          }
        }
      }
      // ─── الحالة الثانية: الموظف لم يسجل أي حضور اليوم إطلاقاً (غياب) ───
      else if (!todayAttendance) {
        const weekendDays = employee.department?.weekendDays || [5, 6];
        if (weekendDays.includes(dayOfWeek)) continue;

        // التحقق من انتهاء الوردية أو انقضاء فترة السماح للدخول
        const isShiftEnded = isCrossDay
          ? (nowMinutes >= shiftEndWithGrace && nowMinutes < shiftStartMinutes)
          : (nowMinutes >= shiftEndWithGrace);

        const checkInGraceExpired = nowMinutes >= (shiftStartMinutes + gracePeriodMinIn);

        // المعالجة تبدأ عند انتهاء الوردية، أو إذا تم التشغيل الإجباري بعد انقضاء فترة السماح
        if (isShiftEnded || (isForce && checkInGraceExpired)) {
          const newAttendance = await this.prisma.attendance.create({
            data: {
              id: randomUUID(),
              date: todayDate,
              status: AttendanceStatus.ABSENT,
              employeeProfileId: employee.id,
              shiftId: shift.id,
              shiftName: shift.name,
              shiftStart: shift.startTime,
              shiftEnd: shift.endTime,
              graceIn: shift.gracePeriodMinIn,
              graceOut: shift.gracePeriodMinOut,
              managerName: shift.managerName || employee.manager?.user?.fullName || 'بدون مدير',
              departmentName: employee.department?.name || 'بدون قسم',
              adminNotes: 'غياب تلقائي - لم يسجل حضور اليوم',
            },
          });

          const adminPrefs = admin || {
            isActiveDeduction: true,
            absentDeductionEnabled: true,
            autoCheckoutEnabled: true,
            combineDeductionsOnEndShift: true,
            delayDeductionEnabled: true,
            earlyLeaveDeductionEnabled: true,
          };

          if (adminPrefs.isActiveDeduction && adminPrefs.absentDeductionEnabled) {
            await this.salaryDeductionDaily(employee.id, adminPrefs, newAttendance.id);
          }

          results.push({
            id: newAttendance.id,
            employeeProfileId: employee.id,
            outcome: 'ABSENT',
            details: `تسجيل غياب تلقائي للموظف لعدم الحضور وتطبيق خصم الغياب المقابل`,
          });
        }
      }
    }

    return {
      processed: results.length,
      results,
      message: results.length > 0
        ? `تمت المعالجة التلقائية لـ ${results.length} موظف بنجاح (خروج تلقائي/غياب)`
        : 'لا توجد سجلات تحتاج لمعالجة تلقائية حالياً (جميع الموظفين منضبطون أو خارج أوقات انتهاء الورديات)',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // حالة الحضور اليومي للموظف
  // ─────────────────────────────────────────────────────────────
  async getTodayAttendanceStatus(userId: string) {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const todayStr = format(nowZoned, 'yyyy-MM-dd');
    const today = new Date(`${todayStr}T00:00:00.000Z`);

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
    includeDiscipline: boolean = true,
  ) {
    try {
      const skip = (page - 1) * limit;
      const where: any = {};

      if (search && search.trim() !== '') {
        where.OR = [
          { fullName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ];
      }

      if (roleFilter && roleFilter !== 'all' && roleFilter !== 'ALL') {
        where.role = roleFilter;
      }

      const [results , total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            adminProfile: {
              include: {
                managedDepartments: {
                  include: { shift: true },
                },
              },
            },
            employeeProfile: {
              include: {
                manager: true,
                department: true,
                shift: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      let enrichedResults :any[]= results;
      
      if (includeDiscipline) {
        enrichedResults = await Promise.all(
          results.map(async (u) => {
            if (u.employeeProfile && u.role === "EMPLOYEE") {
              const enriched = await this.statsHelper.enrichEmployeeData(u.employeeProfile);
              return {
                ...u,
                employeeProfile: {
                  ...u.employeeProfile!,
                  managerId: u.employeeProfile.manager?.userId,
                  disciplineRate: {
                    rate: enriched.disciplineRate?.rate ?? 0,
                    label: enriched.disciplineRate?.label ?? 'NEEDS_IMPROVEMENT',
                    periodCountDiscipline: enriched.disciplineRate?.periodCountDiscipline ?? 'آخر 30 يوم',
                  }
                }
              };
            } else if (u.adminProfile && (u.role === "MANAGER"|| u.role === "SUPER_ADMIN")) {
              const enriched = await this.statsHelper.computeOrganizationDiscipline(u.id);
              return {
                ...u,
                adminProfile: {
                  ...u.adminProfile!,
                  organizationDiscipline: {
                    rate: enriched.organizationRate,
                    label: enriched.organizationLabel,
                    periodCountDiscipline: enriched.periodCountDiscipline,
                  }
                }
              };
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
  // salaryDeductionDaily - خصم الراتب اليومي
  // ─────────────────────────────────────────────────────────────
  async salaryDeductionDaily(
    employeeId: string,
    customAdminPreferences?:  {
      autoCheckoutEnabled?: boolean;
      isActiveDeduction?: boolean;
      combineDeductionsOnEndShift?: boolean;
      delayDeductionEnabled?: boolean;
      earlyLeaveDeductionEnabled?: boolean;
      absentDeductionEnabled?:boolean;
    },
    targetAttendanceId?: string,
  ): Promise<{ deducted: number; newTotalDeduction: number; breakdown: Record<string, number> }> {
    const todayStr = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const today = startOfDay(toZonedTime(Date.now(), TZ));

    const employee: any = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: {
        manager: true,
        department: true,
        shift: true,
        attendances: targetAttendanceId
          ? {
              where: { id: targetAttendanceId },
              include: { excuses: true },
            }
          : {
              where: {
                OR: [
                  { date: todayDate },
                  { date: today },
                ],
              },
              orderBy: { date: 'desc' },
              include: { excuses: true },
            },
      },
    });

    if (!employee) throw new NotFoundException('لم يتم العثور على ملف الموظف');

    const admin = customAdminPreferences || employee?.manager || {
      isActiveDeduction: true,
      combineDeductionsOnEndShift: true,
      delayDeductionEnabled: true,
      earlyLeaveDeductionEnabled: true,
      absentDeductionEnabled: true,
    };

    // إذا كان الخصم اليومي معطلاً بالكامل لدى المدير
    if (admin.isActiveDeduction === false) {
      return {
        deducted: 0,
        newTotalDeduction: employee.attendances?.[0]?.salaryDeduction ?? 0,
        breakdown: { 'خصم الراتب اليومي معطل في إعدادات المدير': 0 },
      };
    }

    const todayAttendance = employee.attendances?.[0] ?? null;
    if (!todayAttendance) {
      return {
        deducted: 0,
        newTotalDeduction: 0,
        breakdown: { reason: 0 },
      };
    }

    const dept = employee.department;
    const monthlyDays = dept?.monthlyWorkingDays && dept.monthlyWorkingDays > 0 ? dept.monthlyWorkingDays : 22;
    const baseSalary: number = employee.salary ?? 0;

    let shiftHours = 8;
    if (employee.shift?.startTime && employee.shift?.endTime) {
      const [sh, sm] = employee.shift.startTime.split(':').map(Number);
      const [eh, em] = employee.shift.endTime.split(':').map(Number);
      const sMin = sh * 60 + sm;
      const eMin = eh * 60 + em;
      const dur = eMin < sMin ? (24 * 60 - sMin + eMin) : (eMin - sMin);
      if (dur > 0) shiftHours = dur / 60;
    }

    const hourlyRate = baseSalary / (monthlyDays * shiftHours);
    const minuteRate = hourlyRate / 60;
    const dailyRate = baseSalary / monthlyDays;

    const { status, excuses = [], delayMinutes = 0, earlyLeaveMinutes = 0 } = todayAttendance;

    const approvedExcuses = (excuses || []).filter((e: any) => e.isApproved);
    const hasApprovedLateExcuse = approvedExcuses.some((e: any) => e.type === 'LATE');
    const hasApprovedAbsentExcuse = approvedExcuses.some((e: any) => e.type === 'ABSENT');
    const hasApprovedEarlyExcuse = approvedExcuses.some((e: any) => e.type === 'EARLY_DEPARTURE');

    const breakdown: Record<string, number> = {};
    let lateDeduction = 0;
    let earlyLeaveDeduction = 0;
    let absentDeduction = 0;

    // 1. خصم التأخير: أولوية لقيمة القسم، أو احتساب ديناميكي بمعدل ساعة العمل
    if (admin.delayDeductionEnabled !== false && delayMinutes > 0 && !hasApprovedLateExcuse) {
      if (dept?.latePenaltyAmount && dept.latePenaltyAmount > 0) {
        lateDeduction = Math.round(dept.latePenaltyAmount);
      } else {
        lateDeduction = Math.ceil(delayMinutes * minuteRate);
      }
      breakdown.late = lateDeduction;
    }

    // 2. خصم المغادرة المبكرة أو الهروب
    if (admin.earlyLeaveDeductionEnabled !== false && !hasApprovedEarlyExcuse) {
      if (dept?.earlyLeavePenaltyAmount && dept.earlyLeavePenaltyAmount > 0) {
        earlyLeaveDeduction = Math.round(dept.earlyLeavePenaltyAmount);
      } else if (earlyLeaveMinutes > 0) {
        earlyLeaveDeduction = Math.ceil(earlyLeaveMinutes * minuteRate);
      } else if (status === AttendanceStatus.ESCAPY) {
        earlyLeaveDeduction = Math.ceil(dailyRate / 2);
      }
      if (earlyLeaveDeduction > 0) {
        breakdown.earlyLeave = earlyLeaveDeduction;
      }
    }

    // 3. خصم الغياب
    if (admin.absentDeductionEnabled !== false && status === AttendanceStatus.ABSENT && !hasApprovedAbsentExcuse) {
      if (dept?.absentPenaltyAmount && dept.absentPenaltyAmount > 0) {
        absentDeduction = Math.round(dept.absentPenaltyAmount);
      } else {
        absentDeduction = Math.ceil(dailyRate);
      }
      breakdown.absent = absentDeduction;
    }

    let appliedCount = 0;
    if (lateDeduction > 0) appliedCount++;
    if (earlyLeaveDeduction > 0) appliedCount++;
    if (absentDeduction > 0) appliedCount++;

    let todayDeduction = 0;
    if (admin.combineDeductionsOnEndShift === true) {
      // دمج كافة الخصومات المستحقة لليوم معاً
      todayDeduction = lateDeduction + earlyLeaveDeduction + absentDeduction;
    } else {
      // تطبيق الخصم الأكبر أو ذو الأولوية
      if (absentDeduction > 0) {
        todayDeduction = absentDeduction;
      } else if (earlyLeaveDeduction > 0) {
        todayDeduction = earlyLeaveDeduction;
      } else {
        todayDeduction = lateDeduction;
      }
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
      data: {
        salaryDeduction: todayDeduction,
        deductionsCount: appliedCount,
        deductionBreakdown: breakdown,
      },
    });

    return {
      deducted: todayDeduction,
      newTotalDeduction: todayDeduction,
      breakdown,
    };
  }
}
