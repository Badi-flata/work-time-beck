import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseISO, startOfDay, addDays, addMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Riyadh';

@Injectable()
export class UtilitiesService {
  constructor(private prisma: PrismaService) { }

  // GET /managing/dashboard?date=2026-05-18
  async getDashboard(managerId: string, date: string) {
    const targetDate = startOfDay(parseISO(date));

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

    // تصنيف دقيق لحالات الحضور
    const present = admin.subordinates.filter((e: any) => 
      e.attendances.length > 0 && 
      e.attendances[0].checkIn && 
      (e.attendances[0].status === 'ON_TIME' || e.attendances[0].status === 'LATE')
    );

    const absent = admin.subordinates.filter((e: any) => 
      e.attendances.length === 0 || 
      (e.attendances.length > 0 && e.attendances[0].status === 'ABSENT')
    );

    const excused = admin.subordinates.filter((e: any) => 
      e.attendances.length > 0 && e.attendances[0].status === 'EXCUSED'
    );

    const late = present.filter((e: any) => e.attendances[0].status === 'LATE');
    const onTime = present.filter((e: any) => e.attendances[0].status === 'ON_TIME');

    return {
      total: admin.subordinates.length,
      present: present.length,
      absent: absent.length,
      excused: excused.length,
      late: late.length,
      onTime: onTime.length,
      details: { present, absent, excused, late, onTime }
    };
  }

  // جلب سجل أسبوعي للموظف الحالي (تعديل المقارنة إلى lt لضمان 7 أيام بدقة)
  async getWeeklyReport(userId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addDays(start, 7);

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
        date: { gte: start, lt: end }
      },
      orderBy: { date: 'asc' }
    });
  }

  // جلب سجل أسبوعي لجميع موظفي المدير (تعديل المقارنة إلى lt لضمان 7 أيام بدقة)
  async latestWeekReport(managerUserId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addDays(start, 7);

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
                date: { gte: start, lt: end },
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

  // جلب سجل شهري للموظف الحالي (تغطية شهر كامل بدقة)
  async getMonthlyReport(userId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addMonths(start, 1);

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
        date: { gte: start, lt: end }
      },
      orderBy: { date: 'asc' }
    });
  }

  // جلب سجل شهري لجميع موظفي المدير
  async latestMonthReport(managerUserId: string, startDate: string) {
    const start = startOfDay(parseISO(startDate));
    const end = addMonths(start, 1);

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
                date: { gte: start, lt: end },
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

  // جلب حالة حضور اليوم للموظف
  async getTodayAttendanceStatus(userId: string) {
    const today = startOfDay(toZonedTime(Date.now(), TZ));

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: {
          include: {
            shift: true,
            attendances: {
              where: { date: today }
            }
          }
        }
      }
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
