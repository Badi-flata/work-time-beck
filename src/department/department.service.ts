import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  // جلب جميع الأقسام التابعة للمدير مع عدد الموظفين والورديات
  async findAll(managerUserId: string) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
    });
    if (!admin) {
      throw new UnauthorizedException('المدير غير موجود أو ليس لديه ملف مدير');
    }

    return this.prisma.department.findMany({
      where: { managerId: admin.userId },
      include: {
        _count: { select: { employees: true } },
        shift: {
          select: {
            id: true,
            name: true,
            startTime: true,
            endTime: true,
            gracePeriodMinIn: true,
            gracePeriodMinOut: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
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
      throw new NotFoundException('القسم غير موجود');
    }

    return department;
  }

  // إنشاء قسم جديد مرتبط بالمدير الحالي
  async create(managerUserId: string, dto: CreateDepartmentDto) {
    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
    });
    if (!admin) {
      throw new UnauthorizedException('المدير غير موجود أو ليس لديه ملف مدير');
    }

    const department = await this.prisma.department.create({
      data: {
        id: randomUUID(),
        name: dto.name,
        description: dto.description,
        managerId: admin.userId,
      },
    });

    return {
      message: 'تم إنشاء القسم بنجاح',
      department,
    };
  }

  // تحديث اسم أو وصف القسم
  async update(id: string, dto: UpdateDepartmentDto) {
    const exists = await this.prisma.department.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('القسم غير موجود');
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });

    return {
      message: 'تم تحديث القسم بنجاح',
      department: updated,
    };
  }

  // حذف قسم — يرفض إذا كان فيه موظفون
  async remove(id: string) {
    const exists = await this.prisma.department.findUnique({ where: { id } });
    if (!exists) {
      throw new NotFoundException('القسم غير موجود');
    }

    // التحقق من عدم وجود موظفين
    const employeeCount = await this.prisma.employeeProfile.count({
      where: { departmentId: id },
    });

    if (employeeCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف القسم لأنه يحتوي على ${employeeCount} موظف. يرجى نقلهم أولاً.`,
      );
    }

    // حذف الورديات المرتبطة ثم القسم
    await this.prisma.shift.deleteMany({ where: { departmentsId: id } });
    await this.prisma.department.delete({ where: { id } });

    return { message: 'تم حذف القسم بنجاح' };
  }

  // قائمة أسماء الأقسام فقط — للاستخدام في dropdowns
  async listNames() {
    return this.prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
