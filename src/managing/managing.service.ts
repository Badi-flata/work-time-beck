import { Injectable } from '@nestjs/common';
import { ManagingDto } from './dto/managing.dto';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { shift } from './dto/shfit.dto';

@Injectable()
export class ManagingService {
  constructor(private prisma: PrismaService) { }
   //  جلب جميع العمال  لدى المدير 
  // get all workers for the manager
  getMyWorkers(userId: string) {
    return this.prisma.adminProfile.findMany({
      where: {
        userId:userId
      },
      include: {
        // بيانات العمال
        // get employee data
        subordinates: {
          select: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
                // الراتب 
                // salary
                employeeProfile: {
                  select: {
                    salary: true,
                    isWorking: true
                  }
                }

              }
            },
            // جلب جميع الحضور الخاصة بالعامل
            // get all attendances for the employee
            attendances: {
              select: {
                date: true,
                checkIn: true,
                checkOut: true,
                status: true,
                delayMinutes: true,
                earlyLeaveMinutes: true,
                totalWorkedMinutes: true,
                adminNotes: true
              }
            },
            // جلب جميع الحضور الخاصة بالعامل
            // get all attendances for the employee
            shift: {
              select: {
                name: true,
                startTime: true,
                endTime: true,
                gracePeriodMin: true
              }
            },
          }
        },
      }
    })
  }

  // أضافة عامل لدى المدير 
  // adding worker to the manager
  async addworker(employeeUserId: string, managerUserId: string) {
    // 1. جلب بيانات المدير
    const manager = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId }
    });
    if (!manager) throw new UnauthorizedException("المدير غير موجود أو ليس لديه ملف مدير");

    // 2. جلب بيانات العامل
    const check = await this.prisma.user.findUnique({
      where: { id: employeeUserId },
      select: {
        id: true,
        role: true,
        employeeProfile: {
          select: {
            id: true
          }
        }
      }
    });

    if (!check || check.role !== Role.EMPLOYEE || !check.employeeProfile) {
      throw new UnauthorizedException("العامل غير موجود او ليس عامل");
    }

    // 3. أضافة العامل لدى المدير
    return this.prisma.employeeProfile.update({
      where: { id: check.employeeProfile.id },
      data: { managerId: manager.id }
    });
  }

 /** 
 *  دالة تدقيق و تعديل و اضافه ملاحظات للعامل من طرف المدير 
 * function to audit and edit and add notes to the employee by the manager
 */
  async handleAndAuditMyEmployees(email:string ,employeeId: string,
          auditDto: auditMyEmployeeDto) {
  try{
    const feiter = {
      ...(employeeId ? { id: employeeId }: {}),
      ...(email ? { email: email }: {}),
    }  
     const check = await this.prisma.user.findFirst({
       where: { 
         ...feiter
       },
       select: {
         role: true,
         employeeProfile: {
           select: {
             id:true,
             managerId: true,
             shiftId: true,
             attendances: {
             select: { id: true }
         }
           }
         },

         
       }
     })

   if (!check || check.role !== Role.EMPLOYEE) throw new UnauthorizedException("العامل غير موجود او ليس عامل");
   

      this.prisma.employeeProfile.update({
       where: {
         userId: check?.employeeProfile?.id
       },
       // معالجة بيانات العامل
       // handling employee data
       data: {
         ...(auditDto.salary && { salary: auditDto.salary }),
         ...(auditDto.isWorking && { isWorking: auditDto.isWorking }),

         ...(auditDto.shiftId && { shiftId: auditDto.shiftId }),
         // جلب جميع الحضور الخاصة بالعامل
         // get all attendances for the employee
        ...(auditDto.employeestatus || auditDto.adminNotes ) && {
           attendances: {
             update: {
               where: { id: auditDto.attendanceId },
               data: {
                 ...(auditDto.employeestatus && { status: auditDto.employeestatus }),
                 ...(auditDto.adminNotes && { adminNotes: auditDto.adminNotes }),
               },
             },
           },
         },
       },
     }) 
     
     return }catch(e){
       throw new Error('خطاء في "auditMyEmployee" , رسالة الخطاء: ' +e.message)
     }
}

  // اضافه مناوبه 
 // adding shift
 async newShfit(Dto:shift){
  const Id = randomUUID()
  try{
  await this.prisma.shift.create({
    data:{
      id:Id,
      name:Dto.name,
      startTime:Dto.startTime,
      endTime:Dto.endTime,
      gracePeriodMin:Dto.gracePeriodMin,
      departmentsId:Dto.departmentsId
    }

  })
  return "تمت الاضافه بنجاح"
 }
 catch(e){
  throw new Error("خطاء في اضافه مناوبه "+e.message)
 }
}

  // حذف عامل من المدير
  // removing employee from manager
  async removeEmployee(employeeUserId: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeUserId }
    });
    if (!employee) throw new UnauthorizedException("العامل غير موجود");

    return this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: { managerId: null }
    });
  }
}
