import { Injectable } from '@nestjs/common';
import { ManagingDto } from './dto/managing.dto';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { shift } from './dto/shfit.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';

@Injectable()
export class ManagingService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
  ) { }

  //  جلب جميع العمال  لدى المدير 
  // get all workers for the manager
  async getMyWorkers(userId: string, page: number = 1, limit: number = 10) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { userId }
    });
    if (!manager) throw new UnauthorizedException("المدير غير موجود أو ليس لديه ملف مدير");

    const total = await this.prisma.employeeProfile.count({
      where: { managerId: manager.id }
    });

    const skip = (page - 1) * limit;

    const subordinates = await this.prisma.employeeProfile.findMany({
      where: { managerId: manager.id },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
            phone: true,
            jobTitle: true,
          }
        },
        shift: true,
      }
    });

    const enrichedSubordinates = await Promise.all(
      subordinates.map(sub =>
        this.statsHelper.enrichEmployeeData(sub, { includeDiscipline: true })
      )
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data: enrichedSubordinates,
      meta: {
        total,
        page,
        limit,
        totalPages
      }
    };
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
   * دالة تدقيق وتعديل وإضافة ملاحظات للعامل من طرف المدير
   * Function to audit, edit, and add notes to the employee by the manager
   */
  async handleAndAuditMyEmployees(email: string, employeeId: string, auditDto: auditMyEmployeeDto) {
    try {
      const filter = {
        ...(employeeId ? { id: employeeId } : {}),
        ...(email ? { email: email } : {}),
      };

      const check = await this.prisma.user.findFirst({
        where: filter,
        select: {
          id: true,
          role: true,
          employeeProfile: {
            select: {
              id: true,
              managerId: true,
              shiftId: true,
            }
          }
        }
      });

      if (!check || check.role !== Role.EMPLOYEE || !check.employeeProfile) {
        throw new UnauthorizedException("العامل غير موجود أو ليس لديه ملف موظف");
      }

      // 1. تحديث بيانات الملف الشخصي للموظف (الراتب، هل يعمل، الوردية)
      const updatedProfile = await this.prisma.employeeProfile.update({
        where: { id: check.employeeProfile.id },
        data: {
          ...(auditDto.salary !== undefined && { salary: auditDto.salary }),
          ...(auditDto.isWorking !== undefined && { isWorking: auditDto.isWorking }),
          ...(auditDto.shiftId && { shiftId: auditDto.shiftId }),
        }
      });

      // تحديث المسمى الوظيفي على جدول User
      if (auditDto.jobTitle !== undefined) {
        await this.prisma.user.update({
          where: { id: check.id },
          data: { jobTitle: auditDto.jobTitle },
        });
      }

      // 2. تحديث سجل حضور الموظف إذا تم إرسال معرف السجل
      if (auditDto.attendanceId && (auditDto.employeestatus || auditDto.adminNotes)) {
        await this.prisma.attendance.update({
          where: { id: auditDto.attendanceId },
          data: {
            ...(auditDto.employeestatus && { status: auditDto.employeestatus }),
            ...(auditDto.adminNotes && { adminNotes: auditDto.adminNotes }),
          }
        });
      }

      return {
        message: "تم تحديث وتدقيق بيانات الموظف بنجاح",
        profile: updatedProfile
      };
    } catch(e) {
      throw new BadRequestException('خطأ في تدقيق بيانات الموظف، رسالة الخطأ: ' + e?.message);
    }
  }

  // اضافه مناوبه 
  // adding shift
  async newShfit(Dto: shift) {
    const Id = randomUUID();
    try {
      await this.prisma.shift.create({
        data: {
          id: Id,
          name: Dto.name,
          startTime: Dto.startTime,
          endTime: Dto.endTime,
          gracePeriodMinIn: Dto.gracePeriodMinIn,
          gracePeriodMinOut: Dto.gracePeriodMinOut,
          departmentsId: Dto.departmentsId,
        },
      });
      return 'تمت إضافة الوردية بنجاح';
    } catch (e) {
      throw new BadRequestException('خطأ في إضافة الوردية: ' + e?.message);
    }
  }

  // جلب الورديات التابعة لأقسام المدير
  async getShifts(managerUserId: string) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId }
    });
    if (!manager) throw new UnauthorizedException("المدير غير موجود أو ليس لديه ملف مدير");

    const departments = await this.prisma.department.findMany({
      where: { managerId: manager.id },
      select: { id: true, name: true }
    });

    const deptIds = departments.map(d => d.id);

    const shifts = await this.prisma.shift.findMany({
      where: { departmentsId: { in: deptIds } },
      include: {
        _count: {
          select: { employees: true }
        },
        departments: {
          select: { name: true }
        }
      }
    });

    return shifts.map(s => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      gracePeriodMinIn: s.gracePeriodMinIn,
      gracePeriodMinOut: s.gracePeriodMinOut,
      departmentsId: s.departmentsId,
      departmentName: s.departments.name,
      employeeCount: s._count.employees,
    }));
  }

  // تعديل وردية
  async updateShift(shiftId: string, dto: UpdateShiftDto) {
    try {
      return await this.prisma.shift.update({
        where: { id: shiftId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.startTime !== undefined && { startTime: dto.startTime }),
          ...(dto.endTime !== undefined && { endTime: dto.endTime }),
          ...(dto.gracePeriodMinIn !== undefined && { gracePeriodMinIn: dto.gracePeriodMinIn }),
          ...(dto.gracePeriodMinOut !== undefined && { gracePeriodMinOut: dto.gracePeriodMinOut }),
          ...(dto.departmentsId !== undefined && { departmentsId: dto.departmentsId }),
        }
      });
    } catch (e) {
      throw new BadRequestException('خطأ في تعديل الوردية: ' + e?.message);
    }
  }

  // حذف وردية
  async deleteShift(shiftId: string) {
    const employeeCount = await this.prisma.employeeProfile.count({
      where: { shiftId }
    });

    if (employeeCount > 0) {
      throw new BadRequestException(`لا يمكن حذف الوردية لأنها مرتبطة بـ ${employeeCount} موظف. يرجى نقلهم أولاً.`);
    }

    await this.prisma.shift.delete({
      where: { id: shiftId }
    });

    return { message: "تم حذف الوردية بنجاح" };
  }

  // قبول/مراجعة عذر الموظف
  async approveExcuse(excuseId: string) {
    const excuse = await this.prisma.excuse.findUnique({
      where: { id: excuseId },
      include: { attendance: true }
    });

    if (!excuse) throw new NotFoundException('العذر غير موجود');

    const updatedExcuse = await this.prisma.excuse.update({
      where: { id: excuseId },
      data: { isApproved: true }
    });

    if (excuse.type === 'IN') {
      await this.prisma.attendance.update({
        where: { id: excuse.attendanceId },
        data: { isExcusedIn: true }
      });
    } else {
      await this.prisma.attendance.update({
        where: { id: excuse.attendanceId },
        data: { isExcusedOut: true }
      });
    }

    return {
      message: 'تم قبول العذر بنجاح وتحديث حالة الحضور',
      excuse: updatedExcuse
    };
  }

  // جلب الأعذار المعلقة للموظفين التابعين للمدير
  async getPendingExcuses(managerUserId: string) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId }
    });
    if (!manager) throw new UnauthorizedException("المدير غير موجود أو ليس لديه ملف مدير");

    return this.prisma.excuse.findMany({
      where: {
        isApproved: false,
        attendance: {
          employeeProfile: { managerId: manager.id }
        }
      },
      include: {
        attendance: {
          include: {
            employeeProfile: {
              include: {
                user: {
                  select: { fullName: true }
                }
              }
            }
          }
        }
      }
    });
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

