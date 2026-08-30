import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DepartmentNotFoundException, DepartmentHasEmployeesException, ManagerProfileNotFoundException } from '../core/domain-exceptions/department.exceptions';
import { ShiftNotFoundException, ShiftHasEmployeesException, ShiftDepartmentNotFoundException } from '../core/domain-exceptions/shift.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════
  // 🏢 DEPARTMENTS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  // جلب جميع الأقسام التابعة للمدير مع عدد الموظفين والورديات
  async findAll(managerUserId: string) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
    });
    if (!admin) {
      throw new ManagerProfileNotFoundException();
    }

    const data = await this.prisma.department.findMany({
      where: { managerId: admin.userId },
      include: {
        _count: { select: { employees: true } },
        shift: {
          select: {
            id: true,
            name: true,
            employees:{
              select:{
                userId:true,
                id:true,
            },
            },
            startTime: true,
            endTime: true,
            gracePeriodMinIn: true,
            gracePeriodMinOut: true,
          },
        },
        employees: {
          select: {
            id:true,
            userId:true,
            user:{
              select:{
                  fullName: true,
                  phone: true,
                  email: true,
                  jobTitle: true,
                }}
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return ResponseHelper.success(data, 'تم جلب الأقسام بنجاح');
  }

  // جلب قسم واحد بالتفصيل
  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        employees: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
                jobTitle: true,
              },
            },
          },
        },
        shift: true,
        _count: { select: { employees: true } },
      },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    return ResponseHelper.success(department, 'تم جلب القسم بنجاح');
  }

  // إنشاء قسم جديد مرتبط بالمدير الحالي
  async create(managerUserId: string, dto: CreateDepartmentDto) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
    });
    if (!admin) {
      throw new ManagerProfileNotFoundException();
    }

    const department = await this.prisma.department.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        description: dto.description,
        managerId: admin.userId,
      },
    });

    return ResponseHelper.created(department, 'تم إنشاء القسم بنجاح');
  }

  // تحديث اسم أو وصف القسم
  async update(id: string, dto: UpdateDepartmentDto) {
    const exists = await this.prisma.department.findUnique({ where: { id } });
    if (!exists) {
      throw new DepartmentNotFoundException();
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    return ResponseHelper.success(updated, 'تم تحديث القسم بنجاح');
  }

  // حذف قسم — يرفض إذا كان فيه موظفون
  async remove(id: string) {
    const exists = await this.prisma.department.findUnique({ where: { id } });
    if (!exists) {
      throw new DepartmentNotFoundException();
    }

    // التحقق من عدم وجود موظفين
    const employeeCount = await this.prisma.employeeProfile.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      throw new DepartmentHasEmployeesException(employeeCount);
    }

    // حذف الورديات المرتبطة ثم القسم
    await this.prisma.shift.deleteMany({ where: { departmentsId: id } });
    await this.prisma.department.delete({ where: { id } });

    return ResponseHelper.success(null, 'تم حذف القسم بنجاح');
  }

  // قائمة أسماء الأقسام فقط — للاستخدام في dropdowns
  async listNames() {
    const data = await this.prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return ResponseHelper.success(data, 'تم جلب أسماء الأقسام بنجاح');
  }

  // ═══════════════════════════════════════════════════════════════════
  // ⏰ SHIFTS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  // إنشاء وردية جديدة
  async createShift(dto: CreateShiftDto) {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentsId },
    });
    if (!department) {
      throw new ShiftDepartmentNotFoundException();
    }

    const shift = await this.prisma.shift.create({
      data: {
        id: randomUUID(),
        managerName: dto.managerName,
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        gracePeriodMinIn: dto.gracePeriodMinIn ?? 15,
        gracePeriodMinOut: dto.gracePeriodMinOut ?? 30,
        departmentsId: dto.departmentsId,
      },
      include: {
        departments: { select: { name: true } },
      },
    });

    return ResponseHelper.created(shift, 'تمت إضافة الوردية بنجاح');
  }

  // جلب جميع الورديات التابعة لأقسام المدير
  async getShifts(managerUserId: string) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
    });
    if (!admin) {
      throw new ManagerProfileNotFoundException();
    }

    const departments = await this.prisma.department.findMany({
      where: { managerId: admin.userId },
      select: { id: true },
    });

    const deptIds = departments.map((d) => d.id);

    const shifts = await this.prisma.shift.findMany({
      where: { departmentsId: { in: deptIds } },
      include: {
        _count: { select: { employees: true } },
        departments: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const data = shifts.map((s) => ({
      id: s.id,
      managerName: s.managerName,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      gracePeriodMinIn: s.gracePeriodMinIn,
      gracePeriodMinOut: s.gracePeriodMinOut,
      departmentsId: s.departmentsId,
      departmentName: s.departments?.name || 'غير محدد',
      employeeCount: s._count.employees,
    }));
    return ResponseHelper.success(data, 'تم جلب الورديات بنجاح');
  }

  // تحديث بيانات وردية
  async updateShift(shiftId: string, dto: UpdateShiftDto) {
    const exists = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!exists) {
      throw new ShiftNotFoundException();
    }

    if (dto.departmentsId) {
      const deptExists = await this.prisma.department.findUnique({
        where: { id: dto.departmentsId },
      });
      if (!deptExists) {
        throw new ShiftDepartmentNotFoundException();
      }
    }

    const updated = await this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.startTime !== undefined && { startTime: dto.startTime }),
        ...(dto.endTime !== undefined && { endTime: dto.endTime }),
        ...(dto.gracePeriodMinIn !== undefined && { gracePeriodMinIn: dto.gracePeriodMinIn }),
        ...(dto.gracePeriodMinOut !== undefined && { gracePeriodMinOut: dto.gracePeriodMinOut }),
        ...(dto.departmentsId !== undefined && { departmentsId: dto.departmentsId }),
        ...(dto.managerName !== undefined && { managerName: dto.managerName }),
      },
      include: {
        departments: { select: { name: true } },
      },
    });

    return ResponseHelper.success(updated, 'تم تحديث الوردية بنجاح');
  }

  // حذف وردية — يرفض إذا كان هناك موظفون مرتبطون بها
  async deleteShift(shiftId: string) {
    const exists = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!exists) {
      throw new ShiftNotFoundException();
    }

    const employeeCount = await this.prisma.employeeProfile.count({
      where: { shiftId },
    });

    if (employeeCount > 0) {
      throw new ShiftHasEmployeesException(employeeCount);
    }

    await this.prisma.shift.delete({ where: { id: shiftId } });

    return ResponseHelper.success(null, 'تم حذف الوردية بنجاح');
  }
}
