import { BadRequestException, Injectable } from '@nestjs/common';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, AttendanceStatus, ExcuseType } from '@prisma/client';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';
import {
  ManagerProfileNotFoundException,
  ExcuseNotFoundException,
  EmployeeNotUnderManagerException,
  AuditEmployeeFailedException,
} from '../core/domain-exceptions/managing.exceptions';
import {
  EmployeeAlreadyAssignedException,
  CannotAssignManagerAsEmployeeException,
  EmployeeNotFoundException,
  EmployeeAlreadyAssignedToYouException
} from '../core/domain-exceptions/employee.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { WorkersListMeta } from '../core/interfaces/global-response.interface';
import { DepartmentNotFoundException, ShiftNotFoundException } from '../core/domain-exceptions';
import { UtilitiesService } from '../utilities/utilities.service';

@Injectable()
export class ManagingService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
    private utilitiesService: UtilitiesService,
  ) { }

  /**
   * جلب جميع العمال لدى المدير مع حساب معدل الانضباط والتقييم الشامل للمؤسسة/القسم
   * يدعم التصفية حسب الوضع (أسبوعي/شهري/يومي/كلي) والقسم
   */
  async getMyWorkers(
    userId: string,
    page: number = 1,
    limit: number = 10,
    mode: Modes = Modes.MONTHLY,
    dateAnchor?: string,
    departmentId?: string,
  ) {
    const manager = await this.prisma.adminProfile.findFirst({
      where: { OR: [{ userId }, { id: userId }] }
    });
    if (!manager) throw new ManagerProfileNotFoundException();

    const whereClause: any = {
      OR: [
        { managerId: manager.id },
        { department: { managerId: manager.id } },
      ],
    };
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    const total = await this.prisma.employeeProfile.count({
      where: whereClause,
    });

    const skip = (page - 1) * limit;

    const subordinates = await this.prisma.employeeProfile.findMany({
      where: whereClause,
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        isWorking: true,
        salary: true,
        user: {
          select: {
            imageProfile: true,
            fullName: true,
            email: true,
            phone: true,
            jobTitle: true,
          }
        },
        shift: {
          select: {
            name: true,
            startTime: true,
            endTime: true,
            managerName: true,
            departments: {
              select: {
                name: true,
              }
            }
          }
        },
      }
    });

    // إثراء بيانات كل موظف بحساب الانضباط حسب الـ Mode المحدد
    const enrichedSubordinates = await Promise.all(
      subordinates.map(async (sub) => {
        const discipline = await this.statsHelper.computeDisciplineRate(
          sub.id,
          mode,
          dateAnchor,
          true,
        );
        return {
          ...sub,
          disciplineRate: discipline,
        };
      })
    );

    // حساب التقييم الشامل لفريق العمل / القسم
    const orgDiscipline = await this.statsHelper.computeOrganizationDiscipline(
      userId,
      mode,
      dateAnchor,
      departmentId,
    );

    const totalPages = Math.ceil(total / limit);

    const meta: WorkersListMeta = {
      page,
      limit,
      totalItems: total,
      totalPages,
      organizationRate: orgDiscipline.organizationRate,
      organizationLabel: orgDiscipline.organizationLabel,
      periodCountDiscipline: orgDiscipline.periodCountDiscipline,
      employeeRates:orgDiscipline.employeeRates
    };

    return ResponseHelper.success(enrichedSubordinates, 'تم جلب قائمة الموظفين بنجاح', 200, meta);
  }

  // أضافة عامل لدى المدير 
  async addworker(
    managerUserId: string,
    dto: { 
      departmentId: string; 
      shiftId: string;
      name?: string; 
      email: string; 
      phone?: string; 
      jobTitle?: string; 
      salary?: number 
      },
      employeeUserId?: string,
      
    ) {

  
    if( dto &&!dto?.email)throw new BadRequestException('البريد الإلكتروني مطلوب');
      if(!dto) throw new BadRequestException('البيانات مطلوبة');
      if(!managerUserId)throw new BadRequestException('معرف المدير مطلوب');

    const manager = await this.prisma.adminProfile.findFirst({
      where: { OR: [{ userId: managerUserId }, { id: managerUserId }] }
    });
    if (!manager) throw new ManagerProfileNotFoundException();

    const check = await this.prisma.user.findFirst({
      where: { OR:[
               {id: employeeUserId },
               {email:dto?.email}
      ]},
      select: {
        id: true,
        role: true,
        employeeProfile: {
          select: {
            id: true,
            managerId: true
          }
        }
      }
    });

    const department = await this.prisma.department.findUnique({
      where: { id: dto?.departmentId }
    });

if( !department ||!dto?.departmentId){
      throw new DepartmentNotFoundException();
    }

    // إذا لم يُحدد shiftId، يتم إسناد أول وردية من القسم تلقائياً
    let resolvedShiftId = dto?.shiftId;
    if (!resolvedShiftId && dto?.departmentId) {
      const defaultShift = await this.prisma.shift.findFirst({
        where: { departmentsId: dto.departmentId },
        orderBy: { name: 'asc' },
      });
      if (defaultShift) resolvedShiftId = defaultShift.id;
    }

    const shift = resolvedShiftId ? await this.prisma.shift.findUnique({
      where: { id: resolvedShiftId }
    }) : null;

  if(!shift ||!resolvedShiftId){
        throw new ShiftNotFoundException();
      }

    if (!check || check.role !== Role.EMPLOYEE || !check.employeeProfile) {
      throw new CannotAssignManagerAsEmployeeException();
    }
    

    if (check.employeeProfile.managerId && check.employeeProfile.managerId !== manager.id) {
      throw new EmployeeAlreadyAssignedException();
    }
    if (check.employeeProfile.managerId && check.employeeProfile.managerId === manager.id) {
      throw new EmployeeAlreadyAssignedToYouException();
    }
 
    
    

    const updateData: any = { managerId: manager.id };
    if (department||dto?.departmentId) updateData.departmentId = department.id || dto.departmentId;
    if (shift||dto?.shiftId) updateData.shiftId = shift.id || dto.shiftId;
    if (dto?.salary !== undefined) updateData.salary = Number(dto.salary);

    const userUpdateData: any = {};
    if (dto?.name !== undefined) userUpdateData.fullName = dto.name;
    if (dto?.email !== undefined) userUpdateData.email = dto.email;
    if (dto?.phone !== undefined) userUpdateData.phone = dto.phone;
    if (dto?.jobTitle !== undefined) userUpdateData.jobTitle = dto.jobTitle;

    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { id: check.id },
        data: userUpdateData,
      });
    }

    const updated = await this.prisma.employeeProfile.update({
      where: { id: check.employeeProfile.id },
      data: updateData,
      include: {
        department: true,
        shift: true,
        user: { select: { id: true, fullName: true, email: true, role: true } }
      }
    });


    return ResponseHelper.success(updated, `تمت نقل الموظف إلى قسم: ${updated.department?.name} و الوردية: ${updated.shift?.name} بنجاح`);
  }

  /** 
   * دالة تدقيق وتعديل وإضافة ملاحظات للعامل من طرف المدير
   */
  async handleAndAuditMyEmployees(email: string, employeeId: string, auditDto: auditMyEmployeeDto) {
    try {
      const filter = {
        ...(employeeId ? { id: employeeId } : {}),
        ...(email ? { email: email } : {}),
      };

      const check = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(employeeId ? [{ id: employeeId }, { employeeProfile: { id: employeeId } }] : []),
            ...(email ? [{ email: email }] : []),
          ],
        },
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
        throw new CannotAssignManagerAsEmployeeException();
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

      return ResponseHelper.success(updatedProfile, 'تم تحديث وتدقيق بيانات الموظف بنجاح');
    } catch (e: any) {
      if (e instanceof CannotAssignManagerAsEmployeeException) throw e;
      throw new AuditEmployeeFailedException(e?.message);
    }
  }

  // فحص وقبول/رفض عذر الموظف (Examination Handling)
  async examineExcuse(
    excuseId: string,
    dto: { isApproved: boolean; adminNotes?: string }
  ) {
    const excuse = await this.prisma.excuse.findUnique({
      where: { id: excuseId },
      include: {
        attendance: true,
      }
    });

    if (!excuse) throw new ExcuseNotFoundException();

    const isApproved = dto.isApproved !== false;

    const updatedExcuse = await this.prisma.excuse.update({
      where: { id: excuseId },
      data: { isApproved }
    });

    if (excuse.attendanceId && excuse.attendance) {
      const att = excuse.attendance;
      const existingNotes = att.adminNotes;
      const newNote = dto.adminNotes || (isApproved ? 'تم قبول العذر من قِبل المدير' : 'تم رفض العذر من قِبل المدير');
      const combinedNotes = [existingNotes, newNote].filter(Boolean).join(' | ');

      const updateData: any = { adminNotes: combinedNotes };

      // إذا تمت الموافقة، نجري استرداداً نوعياً مخصصاً لمبلغ الجزاء المرتبط بنوع العذر فقط
      if (isApproved) {
        if (att.status === AttendanceStatus.ABSENT) {
          updateData.status = AttendanceStatus.EXCUSED;
        }

        let currentTotalDeduction = att.salaryDeduction || 0;
        let currentCount = att.deductionsCount || 0;
        const breakdown = (att.deductionBreakdown as any) || {};

        if (excuse.type === ExcuseType.LATE) {
          const latePart = breakdown.late || 0;
          if (latePart > 0) {
            currentTotalDeduction = Math.max(0, currentTotalDeduction - latePart);
            breakdown.late = 0;
            currentCount = Math.max(0, currentCount - 1);
          }
          updateData.lateMinutes = 0;
        } else if (excuse.type === ExcuseType.EARLY_DEPARTURE) {
          const earlyPart = breakdown.earlyLeave || 0;
          if (earlyPart > 0) {
            currentTotalDeduction = Math.max(0, currentTotalDeduction - earlyPart);
            breakdown.earlyLeave = 0;
            currentCount = Math.max(0, currentCount - 1);
          }
          updateData.earlyLeaveMinutes = 0;
        } else if (excuse.type === ExcuseType.ABSENT) {
          const absentPart = breakdown.absent || 0;
          if (absentPart > 0) {
            currentTotalDeduction = Math.max(0, currentTotalDeduction - absentPart);
            breakdown.absent = 0;
            currentCount = Math.max(0, currentCount - 1);
          }
          updateData.status = AttendanceStatus.EXCUSED;
        }

        updateData.salaryDeduction = currentTotalDeduction;
        updateData.deductionsCount = currentCount;
        updateData.deductionBreakdown = breakdown;
      }

      await this.prisma.attendance.update({
        where: { id: excuse.attendanceId },
        data: updateData,
      });
    }

    return ResponseHelper.success(
      updatedExcuse,
      isApproved ? 'تم قبول العذر وتحديث سجل الحضور بنجاح' : 'تم رفض العذر وتدوين ملاحظات المدير بنجاح'
    );
  }

  // قبول عذر الموظف
  async approveExcuse(excuseId: string, adminNotes?: string) {
    return this.examineExcuse(excuseId, { isApproved: true, adminNotes });
  }

  // رفض عذر الموظف
  async rejectExcuse(excuseId: string, adminNotes?: string) {
    return this.examineExcuse(excuseId, { isApproved: false, adminNotes });
  }

  // جلب الأعذار المعلقة للموظفين التابعين للمدير
  async getPendingExcuses(managerUserId: string) {
    const manager = await this.prisma.adminProfile.findFirst({
      where: { OR: [{ userId: managerUserId }, { id: managerUserId }] }
    });
    if (!manager) throw new ManagerProfileNotFoundException();

    const subordinates = await this.prisma.employeeProfile.findMany({
      where: {
        OR: [
          { managerId: manager.id },
          { department: { managerId: manager.id } },
        ],
      },
      select: { userId: true }
    });
    const subordinateUserIds = subordinates.map(s => s.userId);

    const excuses = await this.prisma.excuse.findMany({
      where: {
        isApproved: false,
        OR: [
          { submittedById: { in: subordinateUserIds } },
          { attendance: { employeeProfile: { managerId: manager.id } } },
          { attendance: { employeeProfile: { department: { managerId: manager.id } } } }
        ]
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
      },
      orderBy: { createdAt: 'desc' }
    });

    const submitterIds = Array.from(new Set(excuses.map(e => e.submittedById).filter(Boolean)));
    const submitters = await this.prisma.user.findMany({
      where: { id: { in: submitterIds } },
      select: { id: true, fullName: true, email: true, phone: true }
    });
    const submitterMap = new Map(submitters.map(u => [u.id, u]));

    const enrichedExcuses = excuses.map((exc) => ({
      ...exc,
      submitter: submitterMap.get(exc.submittedById) || null,
    }));

    return ResponseHelper.success(enrichedExcuses, 'تم جلب الأعذار المعلقة بنجاح');
  }

  // فصل عامل من الفريق
  async firedEmployee(employeeUserId: string) {
    const employee = await this.prisma.employeeProfile.findFirst({
    where: { OR:[
        {userId: employeeUserId },
         {id: employeeUserId}],
        }
    });
    if (!employee) throw new EmployeeNotFoundException();

    if(!employee.managerId) throw new EmployeeNotUnderManagerException()

    const updated = await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: { 
        managerId: null,
        departmentId: null,
        shiftId: null 
       }
    });

    return ResponseHelper.success(updated, 'تم إزالة الموظف من فريقك بنجاح');
  }

  async truneToDepartmentEmployee(managerId:string ,employeeUserId: string ,departmentId: string,  shiftId?: string) {

    const employee = await this.prisma.employeeProfile.findFirst({
      where: { OR:[
        {userId: employeeUserId },
         {id: employeeUserId}],
      
        }
    });

    const mananer = await this.prisma.adminProfile.findFirst({
      where: { 
        OR: [{ userId: managerId }, { id: managerId }]
        }
    });

    if (!mananer) throw new ManagerProfileNotFoundException();
    

    if (employee &&  employee.managerId !== mananer.id) throw new EmployeeNotUnderManagerException()

    if (!employee) throw new EmployeeNotFoundException();
    

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId }
    });
    if (!department) throw new DepartmentNotFoundException();
   console.log("department name:",department.name)
    // إسناد الوردية تلقائياً من القسم إذا لم يُحدد
    let resolvedShiftId = shiftId;
    if (!resolvedShiftId) {
      const defaultShift = await this.prisma.shift.findFirst({
        where: { departmentsId: departmentId },
        orderBy: { name: 'asc' },
      });
      if (defaultShift) resolvedShiftId = defaultShift.id;
    }

    const shift = resolvedShiftId ? await this.prisma.shift.findUnique({
      where: { id: resolvedShiftId }
    }) : null;
    if (!shift) throw new ShiftNotFoundException();

    const updated = await this.prisma.employeeProfile.update({
      where: { id: employee.id },
      data: { departmentId: department.id,
            shiftId: shift.id
            }
    });

    return ResponseHelper.success(updated, `تمت نقل الموظف إلى قسم: ${department.name} و الوردية: ${shift.name} بنجاح`);
  }

  // جلب إعدادات الأتمتة والخصم للمدير
  async getManagerSettings(managerUserId: string) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { id: managerUserId },
      select: {
        autoCheckoutEnabled: true,
        isActiveDeduction: true,
        combineDeductionsOnEndShift: true,
        delayDeductionEnabled: true,
        earlyLeaveDeductionEnabled: true,
        absentDeductionEnabled:true,
      },
    });
    if (!admin) throw new ManagerProfileNotFoundException();
    return ResponseHelper.success(admin, 'تم جلب إعدادات المدير بنجاح');
  }

  // تحديث إعدادات الأتمتة والخصم للمدير
  async updateManagerSettings(
    managerUserId: string,
    dto: {
      autoCheckoutEnabled?: boolean;
      isActiveDeduction?: boolean;
      combineDeductionsOnEndShift?: boolean;
      delayDeductionEnabled?: boolean;
      earlyLeaveDeductionEnabled?: boolean;
      absentDeductionEnabled?:boolean;
    },
  ) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { id: managerUserId },
    });
    if (!admin) throw new ManagerProfileNotFoundException();

    const updated = await this.prisma.adminProfile.update({
      where: { id: managerUserId },
      data: dto,
      select: {
        autoCheckoutEnabled: true,
        combineDeductionsOnEndShift: true,
        delayDeductionEnabled: true,
        earlyLeaveDeductionEnabled: true,
        isActiveDeduction: true,
        absentDeductionEnabled:true,
      },
    });

    return ResponseHelper.success(updated, 'تم تحديث تفضيلات وإعدادات الأتمتة بنجاح');
  }

  // دالة المشغل التلقائي الشامل لجميع المدراء (Scheduled Trigger Runner)
  async triggerScheduledAutomations() {
    const managers = await this.prisma.adminProfile.findMany({
      where: { autoCheckoutEnabled: true },
    });

    const checkoutResults: any[] = [];
    for (const mgr of managers) {
      const res = await this.utilitiesService.automaticallyCheck(mgr.userId);
      checkoutResults.push({ managerId: mgr.userId, ...res });
    }

    return ResponseHelper.success(
      checkoutResults,
      'تم تشغيل الفحص الآلي ومطابقة الورديات بنجاح'
    );
  }
}
