import { Injectable, ConflictException, NotFoundException , UnauthorizedException } from '@nestjs/common';
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

    try{
 
      const employee = await this.prisma.employeeProfile.findUnique({
       where: { userId: employeeId },
       select:{
        id:true,
        manager:{select:{user:{select:{fullName:true}}}},
        department:{select:{name:true}}
       }
     });
      if(!employee){
        throw new NotFoundException('لم يتم العثور على الموظف');
      }
     
     const fullName       = employee.manager?.user?.fullName
     const departmentName = employee.department?.name

     const nowZoned = toZonedTime(parseISO(checkIn), TZ) || toZonedTime(new Date(), TZ) ;
     
     const attendance = await this.prisma.attendance.findUnique({
       where: { employeeProfileId_date: { employeeProfileId: employee.id, date: nowZoned } },
     });
     if(attendance){
       throw new ConflictException('تم تسجيل الحضور بالفعل');
     }
    
     
     const shift = await this.prisma.shift.findUnique({
       where: { id: shiftId },
     });
     if(!shift){
       throw new NotFoundException('لم يتم العثور على الوردية');
     }
   // ── count late minutes ────────────────────────────────────────────────────
    const data = parseISO(checkIn)
     const nowMinutes = data.getHours() * 60 + data.getMinutes();
     const [eh , em]= shift.startTime.split(':');
     const graceMinutes = shift.gracePeriodMinIn ?? 0;
     const shiftStartTime = parseInt(eh) * 60 + parseInt(em) + graceMinutes;
     
     const isLate = nowMinutes > shiftStartTime;
     let lateMinutes = isLate ? nowMinutes - shiftStartTime : 0;
 
      // ──  excusing late or absent  ────────────────────────────────────────────────────
     let status:AttendanceStatus = isLate ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
     const Excused = await this.prisma.excuse.findFirst({
      where:{submittedById:employee.id}
    })
    let excuseinput: any = null;
    if (Excused) {
       excuseinput = {
         id: randomUUID(),
         type:ExcuseType[Excused.type] ,
         reason: Excused.reason,
         submittedById: employeeId,
         isApproved: true,
       };
        if(Excused.type === 'LATE'){
          status = AttendanceStatus.ON_TIME;
          lateMinutes = 0;
        }
        if(Excused.type === 'ABSENT'){
          status = AttendanceStatus.EXCUSED;
        }
     }

     const record =  await this.prisma.attendance.create({
       data: {
         id: `${status}-${checkIn}-${shiftId}`,
         date: startOfDay(nowZoned),
         checkIn: data,
         status,
         managerName:fullName,
         departmentName:departmentName,
         lateMinutes: lateMinutes,
         employeeNote: notes ?? null,
         employeeProfileId: employee.id,
         ...( Excused &&{ excuses: { create: excuseinput } })
       },
       include: { excuses: { select: { type: true, reason: true, isApproved: true } } },
     });

    
     return {
      Message: `تم تسجيل الحضور  ${status === AttendanceStatus.LATE ? 'مع تأخير' : 'بنجاح في الموعد المحدد'}  ` ,
      data: {
        ...record,
        managerName: fullName,
        departmentName: departmentName,
      },
    }}catch(err:unknown){
      console.log("التفاصيل:",err);
  throw new Error('حدث خطأ في تسجيل الحضور');

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

     const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeId },
      select:{
       id:true,
       manager:{select:{user:{select:{fullName:true}}}},
       department:{select:{name:true}}
      }
    });
     if(!employee){
       throw new NotFoundException('لم يتم العثور على الموظف');
     }
    
    const fullName = employee.manager?.user?.fullName
    const departmentName = employee.department?.name
    
    const nowZoned = toZonedTime(new Date(), TZ);

    const attendance = await this.prisma.attendance.findUnique({
      where: { id: attendId },
    });
    if(!attendance){
      throw new NotFoundException('لم يتم تسجيل الحضور لهذا اليوم');
    }

    if(attendance.checkOut){
      throw new ConflictException('تم تسجيل الإنصراف بالفعل');
    }

     const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
    });
    if(!shift){
      throw new NotFoundException('لم يتم العثور على الوردية');
    }
   
  // ── count early leave minutes ────────────────────────────────────────────────────
    const nowMinutes = checkOut.getHours() * 60 + checkOut.getMinutes();
    const [eh , em]= shift.endTime.split(':');
    const graceMinutes = shift.gracePeriodMinOut ?? 0;
    const shiftEndTime = parseInt(eh) * 60 + parseInt(em) - graceMinutes;

    const isEarly = nowMinutes < shiftEndTime;
    let earlyLeaveMinutes = isEarly ? shiftEndTime - nowMinutes : 0;

    const totalWorkedHours = checkOut.getHours() + (attendance?.checkIn?.getMinutes() ?? 0)  ;

   // ──  excusing early departure or absent  ──────────────────────────────────
    let status:AttendanceStatus = isEarly ? AttendanceStatus.ESCAPY : attendance.status;
      const Excused = await this.prisma.excuse.findFirst({
      where:{OR:[
        {submittedById:employeeId},
        {attendanceId:attendId},
      ]}
    })
    let excuseinput: any = null;
    if (Excused) {
       excuseinput = {
         id: randomUUID(),
         type:ExcuseType[Excused.type] ,
         reason: Excused.reason,
         submittedById: employeeId,
         isApproved: true,
       };
        if(Excused.type === 'EARLY_DEPARTURE'){
          status = attendance.status
          earlyLeaveMinutes = 0;
        }
        if(Excused.type === 'ABSENT'){
          status = AttendanceStatus.EXCUSED;
        }
     }

     const record = await this.prisma.attendance.update({
      where: { id: attendId },
      data: {
        checkOut: nowZoned,
        earlyLeaveMinutes: earlyLeaveMinutes,
        totalWorkedHours: totalWorkedHours,
        employeeNote: notes ?? null,
        status,
        excuses: Excused
           ? { create: excuseinput }
           : undefined,
      },
      include: { excuses: { select: { type: true, reason: true, isApproved: true } } },
     });

     return {
      Message: `تم تسجيل الإنصراف بنجاح  ` ,
      data: {
        ...record,
        managerName: fullName,
        departmentName: departmentName,
      },
    };
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

       const handleTime = date !==undefined ? new Date(date) : new Date();
       const time = startOfDay(handleTime)

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
       });
       
       console.log(!!attendReport)
       // Safe access - handles null department and null shift
       const name = employee.user?.fullName || '';
       const departmentName = attendReport?.departmentName ||  employee.department?.name ;
       const managerName = attendReport?.managerName ||  employee.manager?.user?.fullName ;
       const shift = employee.shift;

       const data = {
        name,
        departmentName,
        managerName,
        shift: shift ? {
         shiftId: shift.id,
         name: attendReport?.shiftName ?? shift?.name,
         startTime: attendReport?.shiftStart || shift.startTime,
         endTime: attendReport?.shiftEnd ||shift.endTime,
         gracePeriodMinIn: attendReport?.graceIn ||shift?.gracePeriodMinIn,
         gracePeriodMinOut:attendReport?.graceOut || shift.gracePeriodMinOut,
         } : null,
         ...(attendReport && {CheckValue:{
           id:attendReport?.id,
          status:attendReport?.status,
          checkIn: !!attendReport?.checkIn &&  format(attendReport?.checkIn,"hh:mm"),
          checkOut: attendReport?.checkOut !== null ? format(attendReport?.checkOut,"hh:mm"):"00:00",
          excused:attendReport.excuses,
          notes:attendReport?.adminNotes || attendReport.employeeNote,
          totalWorkedHours:attendReport?.totalWorkedHours,
          earlyLeaveMinutes:attendReport?.earlyLeaveMinutes,
          lateMinutes:attendReport?.lateMinutes, 
         }})
       };

       return {data , message:`تم جلب البيانات الاولية لسجيل الحضور بنجاح, ${!!attendReport ? "مع سجل الحضور لليوم":"مامن سجل حضور لليوم"} ` , status:200} ;
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