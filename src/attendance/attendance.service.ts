import { Injectable, ConflictException, NotFoundException , UnauthorizedException, ForbiddenException, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common';
import {
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  format,
  setMilliseconds,
  differenceInMinutes,
  differenceInHours,
  parseISO,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, ExcuseType ,Role, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SubmitExcuseDto } from './dto/submit-excuse.dto';
import { UtilitiesService } from '../utilities/utilities.service';
import { AlreadyCheckedInException, AlreadyCheckedOutException, CheckOutBeforeCheckInException, CheckInExpiredException, CheckOutExpiredException } from '../core/domain-exceptions/attendance.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { of } from 'rxjs';

const TZ = 'Asia/Riyadh';


@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService , private readonly utiltie:UtilitiesService) {}

  // ─────────────────────────────────────────────────────────────
   // CheckIn - تسجيل الحضور
   // ─────────────────────────────────────────────────────────────
   async checkIn(
     employeeId: string,
     shiftId: string,
     checkIn: string,
     notes?:string,
     excused?: {
       type: "LATE" | "ABSENT",
       reason:string,
         } 
   ) {
     try {
       const employee = await this.prisma.employeeProfile.findFirst({
         where: { OR: [{ id: employeeId }, { userId: employeeId }] },
         select: {
           id: true,
           userId: true,
           manager: { select: {
            autoCheckoutEnabled:true,
            isActiveDeduction:true,
            combineDeductionsOnEndShift:true,
            delayDeductionEnabled:true,
            earlyLeaveDeductionEnabled:true,
            absentDeductionEnabled:true,
            user: { select: { fullName: true } } } },
           department: { select: { name: true } }
         }
       });
       if (!employee) {
         throw new NotFoundException('لم يتم العثور على الموظف');
       }
      const admin = employee.manager
       const fullName = employee.manager?.user?.fullName;
       const departmentName = employee.department?.name;

       const serverZoned = toZonedTime(new Date(), TZ);
       const todayStr = format(serverZoned, 'yyyy-MM-dd');

       let checkInDate: Date;
       try {
         checkInDate = parseISO(checkIn);
         if (isNaN(checkInDate.getTime())) {
           checkInDate = new Date();
         }
       } catch {
         checkInDate = new Date();
       }

       const nowZoned = toZonedTime(checkInDate, TZ);
       const checkInDateStr = format(nowZoned, 'yyyy-MM-dd');

       if (checkInDateStr !== todayStr) {
         throw new CheckInExpiredException();
       }

       const shift = await this.prisma.shift.findUnique({
         where: { id: shiftId },
       });
       if (!shift) {
         throw new NotFoundException('لم يتم العثور على الوردية');
       }

       const [startH, startM] = shift.startTime.split(':').map(Number);
       const [endH, endM] = shift.endTime.split(':').map(Number);
       const isCrossDay = endH < startH || (endH === startH && endM <= startM);

       // Determine correct shift start/end boundary (Cross-day support)
       const startA = new Date(nowZoned);
       startA.setHours(startH, startM, 0, 0);
       const endA = new Date(startA);
       endA.setHours(endH, endM, 0, 0);
       if (isCrossDay) {
         endA.setDate(endA.getDate() + 1);
       }

       let shiftStart: Date = startA;
       let shiftEnd: Date = endA;

       if (isCrossDay) {
         const startB = new Date(nowZoned);
         startB.setDate(startB.getDate() - 1);
         startB.setHours(startH, startM, 0, 0);
         const endB = new Date(startB);
         endB.setHours(endH, endM, 0, 0);
         endB.setDate(endB.getDate() + 1);

         const PREP_MS = 2 * 60 * 60 * 1000; // 2 hours window
         if (nowZoned >= new Date(startB.getTime() - PREP_MS) && nowZoned <= endB) {
           shiftStart = startB;
           shiftEnd = endB;
         }
       }

       const recordDateStr = format(shiftStart, 'yyyy-MM-dd');
       const recordDate = new Date(`${recordDateStr}T00:00:00.000Z`);

       const attendance = await this.prisma.attendance.findUnique({
         where: { employeeProfileId_date: { employeeProfileId: employee.id, date: recordDate } },
       });
       if (attendance) {
         throw new AlreadyCheckedInException();
       }

       // Calculate late minutes
       const graceMinutes = shift.gracePeriodMinIn ?? 0;
       const shiftStartWithGraceMs = shiftStart.getTime() + graceMinutes * 60 * 1000;
       const isLate = nowZoned.getTime() > shiftStartWithGraceMs;
       let lateMinutes = isLate ? Math.max(0, Math.floor((nowZoned.getTime() - shiftStart.getTime()) / (60 * 1000))) : 0;

       let status: AttendanceStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
       
       const dayStart = new Date(`${recordDateStr}T00:00:00.000Z`);
       const dayEnd = new Date(`${recordDateStr}T23:59:59.999Z`);

       const Excused = await this.prisma.excuse.findFirst({
         where: {
           submittedById: employee.userId,
           isApproved: true,
           createdAt: {
             gte: dayStart,
             lte: dayEnd,
           }
         }
       });

       if (Excused) {
         if (Excused.type === 'LATE') {
           status = AttendanceStatus.ON_TIME;
           lateMinutes = 0;
         }
         if (Excused.type === 'ABSENT') {
           status = AttendanceStatus.EXCUSED;
         }
       }

       const isWorking = await this.prisma.employeeProfile.update({
        where: { id: employee.id },
         data: { isWorking: true },
       })

        let record;
        try {
          record = await this.prisma.attendance.create({
            data: {
              id: randomUUID(),
              date: recordDate,
              checkIn: checkInDate,
              status,
              managerName: fullName,
              departmentName: departmentName,
              shiftId: shift.id,
              shiftName: shift.name,
              shiftStart: shift.startTime,
              shiftEnd: shift.endTime,
              graceIn: shift.gracePeriodMinIn,
              graceOut: shift.gracePeriodMinOut,
              lateMinutes: lateMinutes,
              delayMinutes: lateMinutes,
              employeeNote: notes ?? null,
              employeeProfileId: employee.id,
            },
            include: { excuses: { select: { type: true, reason: true, isApproved: true } } },
          });
        } catch (err: any) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new AlreadyCheckedInException();
          }
          throw err;
        }

       if (Excused) {
         await this.prisma.excuse.update({
           where: { id: Excused.id },
           data: { attendanceId: record.id }
         });
       }

       if (admin?.isActiveDeduction === true && admin?.delayDeductionEnabled === true
         && admin.combineDeductionsOnEndShift === false && status === AttendanceStatus.LATE && !Excused
       ) {
              await this.utiltie.salaryDeductionDaily(employee.id,
                 {
                  // swetch actions status
                  autoCheckoutEnabled:admin?.autoCheckoutEnabled,
                  isActiveDeduction:admin?.isActiveDeduction,
                  // deductions actions
                  combineDeductionsOnEndShift:admin?.combineDeductionsOnEndShift,
                  earlyLeaveDeductionEnabled:admin?.earlyLeaveDeductionEnabled,
                  delayDeductionEnabled:admin.delayDeductionEnabled,
                  absentDeductionEnabled:admin?.absentDeductionEnabled,
                });
            }

       return ResponseHelper.success(
         {
           ...record,
           managerName: fullName,
           departmentName: departmentName,
           isWorking,
         },
         `تم تسجيل الحضور ${status === AttendanceStatus.LATE ? 'مع تأخير' : 'بنجاح في الموعد المحدد'}`
       );
     } catch (err: any) {
       if (err.code === 'P2002') {
         throw new AlreadyCheckedInException();
       }
       if (err.status) {
         throw err;
       }
       throw err;
     }
   }
  // ─────────────────────────────────────────────────────────────
   // CheckOut - تسجيل الإنصراف
   // ─────────────────────────────────────────────────────────────
    async checkOut(
      employeeId: string,
      attendId: string,
      shiftId: string,
      checkOut: Date,
      notes?:string,
      excused?: {
        type: "EARLY_DEPARTURE" | "ABSENT",
        reason:string,
      } | null,
    ) {
      try {
        const employee = await this.prisma.employeeProfile.findFirst({
          where: { OR: [{ id: employeeId }, { userId: employeeId }] },
          select: {
            id: true,
            userId: true,
            manager: { select: { user: { select: { fullName: true } } } },
            department: { select: { name: true } }
          }
        });
        if (!employee) {
          throw new NotFoundException('لم يتم العثور على الموظف');
        }
       
        const fullName = employee.manager?.user?.fullName;
        const departmentName = employee.department?.name;
        
        const nowZoned = toZonedTime(new Date(), TZ);
 
        const attendance = await this.prisma.attendance.findUnique({
          where: { id: attendId },
        });
        if (!attendance) {
          throw new CheckOutBeforeCheckInException();
        }
 
        if (attendance.checkOut) {
          throw new AlreadyCheckedOutException();
        }
 
        const effectiveShiftId = attendance.shiftId || shiftId;
        const shift = effectiveShiftId
          ? await this.prisma.shift.findUnique({ where: { id: effectiveShiftId } })
          : null;
       
        let startH = 8, startM = 0, endH = 16, endM = 0;
        let isCrossDay = false;
        if (shift) {
          [startH, startM] = shift.startTime.split(':').map(Number);
          [endH, endM] = shift.endTime.split(':').map(Number);
          isCrossDay = endH < startH || (endH === startH && endM <= startM);
        } else if (attendance.shiftStart && attendance.shiftEnd) {
          [startH, startM] = attendance.shiftStart.split(':').map(Number);
          [endH, endM] = attendance.shiftEnd.split(':').map(Number);
          isCrossDay = endH < startH || (endH === startH && endM <= startM);
        } else {
          throw new NotFoundException('لم يتم العثور على الوردية');
        }
 
        // Same-day check or next-day check for cross-day shift
        const attendDateStr = format(attendance.date, 'yyyy-MM-dd');
        const nowStr = format(nowZoned, 'yyyy-MM-dd');
        
        let isAllowed = nowStr === attendDateStr;
        if (isCrossDay && !isAllowed) {
          const nextDay = new Date(attendance.date);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextDayStr = format(nextDay, 'yyyy-MM-dd');
          isAllowed = nowStr === nextDayStr;
        }
 
        if (!isAllowed) {
          throw new CheckOutExpiredException();
        }
 
        // Calculate shiftEnd Date object using attendance.date (shift start date)
        const shiftEnd = new Date(attendance.date);
        shiftEnd.setHours(endH, endM, 0, 0);
        if (isCrossDay && shiftEnd <= attendance.date) {
          shiftEnd.setDate(shiftEnd.getDate() + 1);
        }
 
        // Check if checked out early
        const isEarly = nowZoned.getTime() < shiftEnd.getTime();
        const earlyLeaveMinutes = isEarly ? Math.max(0, Math.floor((shiftEnd.getTime() - nowZoned.getTime()) / (60 * 1000))) : 0;
 
        // Calculate total worked hours (Float / decimal precision)
        const diffMin = differenceInMinutes(nowZoned, attendance.checkIn!);
        const totalWorkedHours = Math.max(0, Math.round((diffMin / 60) * 10) / 10);
 
        // Check for approved excuse
        const dayStart = startOfDay(attendance.date);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
 
        const Excused = await this.prisma.excuse.findFirst({
          where: {
            submittedById: employee.userId,
            isApproved: true,
            OR: [
              { attendanceId: attendId },
              {
                createdAt: {
                  gte: dayStart,
                  lte: dayEnd
                }
              }
            ]
          }
        });

        if (Excused && !Excused.attendanceId) {
          await this.prisma.excuse.update({
            where: { id: Excused.id },
            data: { attendanceId: attendId }
          });
        }
 
        let status = attendance.status;
        if (isEarly && !Excused && nowStr !== attendDateStr && !isCrossDay) {
          throw new ForbiddenException("لا يمكن تسجيل الانصراف قبل الوقت المحدد");
        }
 
        let finalEarlyLeaveMinutes = earlyLeaveMinutes;
        if (Excused) {
          if (Excused.type === 'EARLY_DEPARTURE') {
            status = attendance.status;
            finalEarlyLeaveMinutes = 0;
          }
          if (Excused.type === 'ABSENT') {
            status = AttendanceStatus.EXCUSED;
          }
        } else if (isEarly) {
          status = AttendanceStatus.ESCAPY;
        }
         const isWorking = await this.prisma.employeeProfile.update({
        where: { id: employee.id },
         data: { isWorking: false },
       })
        const record = await this.prisma.attendance.update({
          where: { id: attendId },
          data: {
            checkOut: nowZoned,
            earlyLeaveMinutes: finalEarlyLeaveMinutes,
            totalWorkedHours: totalWorkedHours,
            employeeNote: notes ?? null,
            status,
          },
          include: { excuses: { select: { type: true, reason: true, isApproved: true } } },
        });
 
 
        return ResponseHelper.success(
          {
            ...record,
            managerName: fullName,
            departmentName: departmentName,
            isWorking
          },
          'تم تسجيل الإنصراف بنجاح'
        );
      } catch (err: any) {
        console.log("التفاصيل:", err);
        if (err instanceof HttpException) {
          throw err;
        }
        throw new InternalServerErrorException(err.message || 'حدث خطأ في تسجيل الانصراف');
      }
    }

 
   // ─────────────────────────────────────────────────────────────
   // getShiftData - الحصول على بيانات الوردية
   // ─────────────────────────────────────────────────────────────
      async fetchSourceData(userId: string,  date?:string ,employeeId?: string) {
        const targetId = employeeId || userId;
        
        // console.log("🚀 ~ AttendanceService ~ fetchSourceData ~ targetId:", targetId)
        const employee = await this.prisma.employeeProfile.findFirst({
          where: {
            OR: [
              { id: targetId },
              { userId: targetId }
            ]
          },
          select: {
            id:true,
            userId:true,
            shift: {
              select:{
                id:true,
                managerName:true,
                name:true,
                startTime:true,
                endTime:true,
                gracePeriodMinIn:true,
                gracePeriodMinOut:true,
              }
            },
            user:{
              select:{
                fullName:true
              }
            },
            department:{
              select:{
                id: true,
                name:true
              }
            },
            manager:{
              select:{
                user:{select:{fullName:true}}
              }
            }
          }
        });
        if(!employee){
          throw new NotFoundException('لم يتم العثور على الموظف');
        }

        const serverZoned = toZonedTime(new Date(), TZ);
        const todayStr = format(serverZoned, 'yyyy-MM-dd');
        const targetDateStr = date ? date : todayStr;
        const queryDate = new Date(`${targetDateStr}T00:00:00.000Z`);
        const periodDate = targetDateStr;

        const attendReport = await this.prisma.attendance.findUnique({
          where: { employeeProfileId_date: { employeeProfileId: employee.id, date: queryDate } },
          include: {
            excuses: {
              select: {
                type: true,
                reason: true,
                isApproved: true,
              }
            }
          }
        }) || null; 


        // 1. ربط الموظف بالقسم في حال عدم وجود قسم
        let department = employee.department;
        if (!department) {
          const firstDept = await this.prisma.department.findFirst({ orderBy: { name: 'asc' } }) || null;
          if (firstDept) {
            department = { id: firstDept.id, name: firstDept.name };
            await this.prisma.employeeProfile.update({
              where: { id: employee.id },
              data: { departmentId: firstDept.id },
            });
          }
        }

        // 2. الوردية الرسمية المعتمدة للموظف حصراً (بدون استبدال بالـ demo)
        // Shift Fallback: إذا لم يملك الموظف وردية مباشرة، يتم استخدام وردية القسم
        let officialShift = employee.shift;
        if (!officialShift && department) {
          const deptShifts = await this.prisma.shift.findMany({
            where: { departmentsId: department.id },
            take: 1, orderBy: { name: 'asc' },
          });
          if (deptShifts.length > 0) officialShift = deptShifts[0];
        }
        const name = employee.user?.fullName || '';
        const departmentName = attendReport ? attendReport.departmentName : (department?.name || '');
        const managerName = attendReport ? attendReport.managerName : (employee.manager?.user?.fullName || '');

        const data = {
          periodDate,
          name,
          departmentName,
          managerName,
          shift: officialShift ? {
            shiftId: officialShift.id,
            name: attendReport?.shiftName || officialShift?.name,
            startTime: attendReport?.shiftStart || officialShift.startTime,
            endTime: attendReport?.shiftEnd || officialShift.endTime,
            gracePeriodMinIn: attendReport?.graceIn ?? officialShift?.gracePeriodMinIn ?? 15,
            gracePeriodMinOut: attendReport?.graceOut ?? officialShift?.gracePeriodMinOut ?? 30,
            isDemo: false,
          } : null,
          CheckValue: attendReport ? {
            id: attendReport.id,
            status: attendReport.status,
            checkIn: attendReport.checkIn ? format(attendReport.checkIn, "HH:mm") : null,
            checkOut: attendReport.checkOut ? format(attendReport.checkOut, "HH:mm") : null,
            excused: attendReport.excuses,
            notes: attendReport.adminNotes || attendReport.employeeNote,
            totalWorkedHours: attendReport.totalWorkedHours,
            earlyLeaveMinutes: attendReport.earlyLeaveMinutes,
            lateMinutes: attendReport.lateMinutes,
          } : null
        };

        return ResponseHelper.success(
          data,
          `تم جلب البيانات الأولية لسجل الحضور بنجاح, ${attendReport ? 'مع سجل الحضور لليوم' : 'تنويه: لا يوجد سجل حضور لليوم حتى الآن'}`
        );
      }

    // ─────────────────────────────────────────────────────────────
    // getOrCreateDemoShift - مسار جلب أو توليد الوردية التجريبية (10 دقائق) المعزولة
    // ─────────────────────────────────────────────────────────────
    async getOrCreateDemoShift(userId: string, employeeId?: string) {
      const targetId = employeeId || userId;
      const employee = await this.prisma.employeeProfile.findFirst({
        where: {
          OR: [{ id: targetId }, { userId: targetId }],
        },
        include: { department: true, manager: { select: { user: { select: { fullName: true } } } }, user: true },
      });
      if (!employee) {
        throw new NotFoundException('لم يتم العثور على الموظف');
      }

      let department = employee.department;
      if (!department) {
        let firstDept = await this.prisma.department.findFirst({ orderBy: { name: 'asc' } }) || null;
        if (!firstDept) {
          firstDept = await this.prisma.department.create({
            data: {
              name: 'القسم العام',
              managerId: employee.managerId || employee.userId,
            },
          });
        }
        department = firstDept;
      }

      let demoShift: any = await this.prisma.shift.findFirst({
        where: {
          departmentsId: department.id,
          OR: [
            { name: { contains: '10' } },
            { name: { contains: 'تجريبية' } },
            { name: { contains: 'التفاعلية' } },
          ],
        },
      });

      const serverZoned = toZonedTime(new Date(), TZ);
      const todayStr = format(serverZoned, 'yyyy-MM-dd');
      const queryDate = new Date(`${todayStr}T00:00:00.000Z`);

      // فحص هل يوجد سجل حضور للـ demo اليوم لتثبيت التوقيت
      const demoAttendance = await this.prisma.attendance.findFirst({
        where: {
          employeeProfileId: employee.id,
          date: queryDate,
          shiftId: demoShift?.id || 'demo-placeholder',
        },
        include: { excuses: true },
      });
      const officialAttendance = await this.prisma.attendance.findUnique({
        where: { employeeProfileId_date:{
          employeeProfileId: employee.id,
          date: queryDate,}
        },
        select:{
          id: true,
          date:true,
          status: true,
          shiftId:true,
          shiftName:true,
          departmentName:true,
          checkIn: true,
          checkOut: true,
        }
 
      });


      const now = toZonedTime(new Date(), TZ);
      const startT = new Date(now.getTime() + 1 * 60 * 1000); // 1 دقيقة تحضير
      const endT = new Date(startT.getTime() + 7 * 60 * 1000); // 7 دقائق دوام

      if (!demoShift) {
        demoShift = await this.prisma.shift.create({
          data: {
            id: randomUUID(),
            name: 'الوردية التفاعلية (10 دقائق)',
            startTime: format(startT, 'HH:mm:ss'),
            endTime: format(endT, 'HH:mm:ss'),
            gracePeriodMinIn: 2,
            gracePeriodMinOut: 2,
            departmentsId: department.id,
          },
        });
      } else if (!demoAttendance || !demoAttendance.checkIn) {
        // تجديد الوردية في حال لم يتم تسجيل الحضور التجريبي اليوم
        demoShift = await this.prisma.shift.update({
          where: { id: demoShift.id },
          data: {
            startTime: format(startT, 'HH:mm:ss'),
            endTime: format(endT, 'HH:mm:ss'),
            gracePeriodMinIn: 2,
            gracePeriodMinOut: 2,
          },
        });
      }

      return ResponseHelper.success(
        {
          periodDate: todayStr,
          name: employee.user?.fullName || '',
          departmentName: department?.name || 'القسم العام',
          managerName: employee.manager?.user?.fullName || '',
          demoShift: {
            shiftId: demoShift.id,
            name: demoShift.name,
            startTime: demoAttendance?.shiftStart || demoShift.startTime,
            endTime: demoAttendance?.shiftEnd || demoShift.endTime,
            gracePeriodMinIn: demoShift.gracePeriodMinIn,
            gracePeriodMinOut: demoShift.gracePeriodMinOut,
            isDemo: true,
          },
          demoCheckValue: demoAttendance ? {
            id: demoAttendance.id,
            status: demoAttendance.status,
            checkIn: demoAttendance.checkIn ? format(demoAttendance.checkIn, "HH:mm") : null,
            checkOut: demoAttendance.checkOut ? format(demoAttendance.checkOut, "HH:mm") : null,
            excused: demoAttendance.excuses,
            notes: demoAttendance.employeeNote || demoAttendance.adminNotes,
            totalWorkedHours: demoAttendance.totalWorkedHours,
            earlyLeaveMinutes: demoAttendance.earlyLeaveMinutes,
            lateMinutes: demoAttendance.lateMinutes,
          } : null,
          todayReport: officialAttendance ? {
            id: officialAttendance.id,
            date: format(officialAttendance.date,'yyyy-MM-dd'),
            status: officialAttendance.status,
            shiftId:officialAttendance.shiftId,
            shiftName: officialAttendance.shiftName,
            departmentName: officialAttendance.departmentName,
            checkIn: officialAttendance.checkIn ? format(officialAttendance.checkIn, "HH:mm") : null,
            checkOut: officialAttendance.checkOut ? format(officialAttendance.checkOut, "HH:mm") : null,
          } : null,
        },
        'تم جلب بيانات الوردية التجريبية المستقلة بنجاح'
      );
    }

    // ─────────────────────────────────────────────────────────────
    // demoCheckIn - تسجيل حضور تجريبي معزول في سجلات الحضور
    // ─────────────────────────────────────────────────────────────
    async demoCheckIn(employeeId: string, shiftId: string, checkIn: string, notes?: string) {
      return this.checkIn(employeeId, shiftId, checkIn, notes);
    }

    // ─────────────────────────────────────────────────────────────
    // demoCheckOut - تسجيل انصراف تجريبي معزول في سجلات الحضور
    // ─────────────────────────────────────────────────────────────
    async demoCheckOut(employeeId: string, attendId: string, shiftId: string, checkOut: Date, notes?: string) {
      return this.checkOut(employeeId, attendId, shiftId, checkOut, notes);
    }

     // ─────────────────────────────────────────────────────────────
   // submitExcuse -  تقديم عذر
   // ─────────────────────────────────────────────────────────────
  async submitExcuse(userId: string, dto: SubmitExcuseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile:{
        select:{ 
          id:true,
          userId:true,
          manager:{
            select:{
              user:{
                select:{
                  fullName:true
                }
              }
            }
          },
          department:{
            select:{
              name:true
            }
          },
          shift:true
        }
      }
       }
    });
    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const nowZoned = toZonedTime(Date.now(), TZ);
    const todayStr = format(nowZoned, 'yyyy-MM-dd');
    const today = new Date(`${todayStr}T00:00:00.000Z`);

    let attendance: any = null;
    if (dto.attendanceId) {
      attendance = await this.prisma.attendance.findUnique({
        where: { id: dto.attendanceId }
      });
    } else {
      attendance = await this.prisma.attendance.findUnique({
        where: { employeeProfileId_date: { employeeProfileId: user.employeeProfile.id, date: today } }
      });
    }

    if (attendance) {
      const excuse = await this.prisma.excuse.create({
        data:{
          id: randomUUID(),
          reason: dto.reason,
          type: dto.type,
          attendanceId: attendance.id,
          submittedById: user.id,
          isApproved: false, // قيد تدقيق ومراجعة المدير
        }
      });
      return ResponseHelper.success(excuse, "تم تقديم طلب العذر بنجاح وهو بانتظار مراجعة واعتماد المدير");
    }

    const excuse = await this.prisma.excuse.create({
      data: {
        id: randomUUID(),
        reason: dto.reason,
        type: dto.type,
        submittedById: user.id,
        isApproved: false, // قيد تدقيق ومراجعة المدير
      }
    });

    return ResponseHelper.success(excuse, "تم تقديم طلب العذر بنجاح وهو بانتظار مراجعة واعتماد المدير");
  }
} 