import { Injectable, ConflictException, NotFoundException , UnauthorizedException, ForbiddenException } from '@nestjs/common';
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
import { AttendanceStatus, ExcuseType ,Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SubmitExcuseDto } from './dto/submit-excuse.dto';
import { UtilitiesService } from '../utilities/utilities.service';
import { fromFetch } from 'rxjs/fetch';
import { AllExceptionsFilter } from 'src/core/filters/all-exceptions.filter';
import { error } from 'console';
import { networkInterfaces } from 'os';

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
       const employee = await this.prisma.employeeProfile.findUnique({
         where: { userId: employeeId },
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

       const startB = new Date(nowZoned);
       startB.setDate(startB.getDate() - 1);
       startB.setHours(startH, startM, 0, 0);
       const endB = new Date(startB);
       endB.setHours(endH, endM, 0, 0);
       if (isCrossDay) {
         endB.setDate(endB.getDate() + 1);
       }

       const PREP_MS = 2 * 60 * 60 * 1000; // 2 hours window
       let shiftStart: Date;
       let shiftEnd: Date;

       if (nowZoned >= new Date(startB.getTime() - PREP_MS) && nowZoned <= endB) {
         shiftStart = startB;
         shiftEnd = endB;
       } else {
         shiftStart = startA;
         shiftEnd = endA;
       }

       const attendance = await this.prisma.attendance.findUnique({
         where: { employeeProfileId_date: { employeeProfileId: employee.id, date: startOfDay(shiftStart) } },
       });
       if (attendance) {
         throw new ConflictException('تم تسجيل الحضور بالفعل');
       }

       const serverZoned = toZonedTime(new Date(), TZ);
       const onThisDay = format(nowZoned, 'yyyy-MM-dd') === format(serverZoned, 'yyyy-MM-dd');
       if (!onThisDay) {
         throw new ForbiddenException("لا يمكن تسجيل الحضور في سجل قديم");
       }

       // Calculate late minutes
       const graceMinutes = shift.gracePeriodMinIn ?? 0;
       const shiftStartWithGraceMs = shiftStart.getTime() + graceMinutes * 60 * 1000;
       const isLate = nowZoned.getTime() > shiftStartWithGraceMs;
       let lateMinutes = isLate ? Math.max(0, Math.floor((nowZoned.getTime() - shiftStart.getTime()) / (60 * 1000))) : 0;

       let status: AttendanceStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
       
       const dayStart = startOfDay(shiftStart);
       const dayEnd = new Date(dayStart);
       dayEnd.setHours(23, 59, 59, 999);

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

       const record = await this.prisma.attendance.create({
         data: {
           id: `${status}-${checkIn}-${shiftId}`,
           date: startOfDay(shiftStart),
           checkIn: checkInDate,
           status,
           managerName: fullName,
           departmentName: departmentName,
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

       if (Excused) {
         await this.prisma.excuse.update({
           where: { id: Excused.id },
           data: { attendanceId: record.id }
         });
       }

       return {
         Message: `تم تسجيل الحضور  ${status === AttendanceStatus.LATE ? 'مع تأخير' : 'بنجاح في الموعد المحدد'}  `,
         data: {
           ...record,
           managerName: fullName,
           departmentName: departmentName,
         },
       };
     } catch (err: any) {
       console.log("التفاصيل:", err);
       if (err.status) {
         throw err;
       }
       throw new Error(err.message || 'حدث خطأ في تسجيل الحضور');
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
    ): Promise<{Message:string , data:any|null}> {
      try {
        const employee = await this.prisma.employeeProfile.findUnique({
          where: { userId: employeeId },
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
          throw new NotFoundException('لم يتم تسجيل الحضور لهذا اليوم');
        }
 
        if (attendance.checkOut) {
          throw new ConflictException('تم تسجيل الإنصراف بالفعل');
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
          throw new ForbiddenException("لا يمكن تسجيل الانصراف في سجل حضور قديم");
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
 
        // Calculate total worked hours (Int)
        const diffMin = differenceInMinutes(nowZoned, attendance.checkIn!);
        const totalWorkedHours = Math.max(0, Math.round(diffMin / 60));
 
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
 
        if (Excused && !Excused.attendanceId) {
          await this.prisma.excuse.update({
            where: { id: Excused.id },
            data: { attendanceId: attendId }
          });
        }
 
        return {
          Message: `تم تسجيل الإنصراف بنجاح`,
          data: {
            ...record,
            managerName: fullName,
            departmentName: departmentName,
          },
        };
      } catch (err: any) {
        console.log("التفاصيل:", err);
        if (err.status) {
          throw err;
        }
        throw new Error(err.message || 'حدث خطأ في تسجيل الانصراف');
      }
    }

 
   // ─────────────────────────────────────────────────────────────
   // getShiftData - الحصول على بيانات الوردية
   // ─────────────────────────────────────────────────────────────
      async fetchSourceData(userId: string, employeeId?: string, date?:string) {
        const targetId = employeeId || userId;
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

        let targetDate: Date;
        if (date) {
          try {
            targetDate = toZonedTime(parseISO(date), TZ);
          } catch {
            targetDate = toZonedTime(new Date(), TZ);
          }
        } else {
          targetDate = toZonedTime(new Date(), TZ);
        }
        const time = startOfDay(targetDate);
        const periodDate = format(targetDate, 'yyyy-MM-dd');

        const attendReport = await this.prisma.attendance.findUnique({
          where:{employeeProfileId_date: {  employeeProfileId:employee.id ,date:time}},
          include:{
            excuses:{
              select:{
                type:true,
                reason:true,
                isApproved:true
              }
            }
          }
        }) || null;
        
        console.log("isAttend", attendReport !== null);
        console.log("time is:", time);
        
        const name = employee.user?.fullName || '';
        const departmentName = attendReport ? attendReport.departmentName : employee.department?.name ;
        const managerName = attendReport ? attendReport.managerName : employee.manager?.user?.fullName ;
        const shift = employee.shift;

        const data = {
          periodDate,
          name,
          departmentName,
          managerName,
          shift: shift ? {
            shiftId: shift.id,
            name: attendReport?.shiftName || shift?.name,
            startTime: attendReport?.shiftStart || shift.startTime,
            endTime: attendReport?.shiftEnd || shift.endTime,
            gracePeriodMinIn: attendReport?.graceIn || shift?.gracePeriodMinIn,
            gracePeriodMinOut: attendReport?.graceOut || shift.gracePeriodMinOut,
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

        return {
          data,
          message: `تم جلب البيانات الاولية لسجيل الحضور بنجاح, ${attendReport ? "مع سجل الحضور لليوم" : "مامن سجل حضور لليوم"}`,
          status: 200
        };
      }

     // ─────────────────────────────────────────────────────────────
   // submitExcuse -  تقديم عذر
   // ─────────────────────────────────────────────────────────────
  async submitExcuse(userId: string, dto: SubmitExcuseDto) {
    if(dto.isApproved === false)return {Message:" العذر مرفوض ",data:dto , status:400}
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

    const today = startOfDay(toZonedTime(Date.now(), TZ));

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
        isApproved: true,
          
        }
      })
    return {Message:"تم قبول العذر", data:excuse, status:200}
    }

    const excuse = await this.prisma.excuse.create({
      data: {
        id: randomUUID(),
        reason: dto.reason,
        type: dto.type,
        submittedById: user.id,
        isApproved: true,
      }
    });

    

    return excuse;
  }
} 