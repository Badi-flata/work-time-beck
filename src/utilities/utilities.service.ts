import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UtilitiesService {
  constructor(private prisma: PrismaService) { }

  // GET /managing/dashboard?date=2026-05-18
  async getDashboard(managerId: string, date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

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
              }
            },
            attendances: {
              where: { date: targetDate }
            }
          }
        }
      }
    });

    if (!admin) {
      throw new NotFoundException('لم يتم العثور على حساب المدير');
    }

    const present = admin.subordinates.filter((e: any) => e.attendances.length > 0 && e.attendances[0].checkIn);
    const absent = admin.subordinates.filter((e: any) => e.attendances.length === 0);
    const late = present.filter((e: any) => e.attendances[0].status === 'LATE');
    const onTime = present.filter((e: any) => e.attendances[0].status === 'ON_TIME');

    return {
      total: admin.subordinates.length,
      present: present.length,
      absent: absent.length,
      late: late.length,
      onTime: onTime.length,
      details: { present, absent, late, onTime }
    };
  }

  // جلب سجل أسبوعي للموظف الحالي
  async getWeeklyReport(userId: string, startDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true }
    });

    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    return this.prisma.attendance.findMany({
      where: {
        employeeProfileId: user.employeeProfile.id,
        date: { gte: start, lte: end }
      },
      orderBy: { date: 'asc' }
    });
  }

  // جلب سجل أسبوعي لجميع موظفي المدير
  async latestWeekReport(managerUserId: string, startDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const admin = await this.prisma.adminProfile.findUnique({
      where: { userId: managerUserId },
      include: {
        subordinates: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
                phone: true,
              }
            },
            attendances: {
              where: {
                date: { gte: start, lte: end },
              },
              orderBy: { date: 'asc' },
            }
          }
        }
      }
    });

    if (!admin) {
      throw new NotFoundException('لم يتم العثور على حساب المدير');
    }

    return admin.subordinates;
  }

  // جلب تقرير أسبوعي لموظف معين بواسطة المدير
  async getAEmployeeWeeklyReport(employeeUserId: string, startDate: string) {
    return this.getWeeklyReport(employeeUserId, startDate);
  }

  // البحث عن مستخدم (عامل أو مدير) بصيغة Prisma آمنة
  async searchUsers(search: string) {
    try {
      const result = await this.prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } }
          ]
        },
        include: {
          adminProfile: true,
          employeeProfile: {
            include: {
              department: true,
              shift: true
            }
          }
        }
      });

      if (!result || result.length === 0) {
        return [];
      }
      return result;
    } catch (e) {
      throw new UnauthorizedException("حدث خطأ في البحث");
    }
  }
}
