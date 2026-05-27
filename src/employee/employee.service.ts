import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Riyadh';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: {
          include: {
            department: true,
            shift: true,
            manager: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    if (user.employeeProfile) {
      const enriched = await this.statsHelper.enrichEmployeeData(
        user.employeeProfile,
        { includeDiscipline: true, disciplineDays: 30 }
      );
      return { ...user, employeeProfile: enriched };
    }
    return user;
  }

  async addOrChangeManager(managerId: string, MyId: string) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { id: managerId }
    });
    if (!manager) throw new NotFoundException('المدير غير موجود');

    await this.prisma.employeeProfile.update({
      where: { userId: MyId },
      data: { managerId: managerId }
    });

    return { message: 'تم تعيين المدير بنجاح' };
  }

  async getMyDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true }
    });
    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const start = startOfDay(addDays(toZonedTime(Date.now(), TZ), -7));

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId: user.employeeProfile.id,
        date: { gte: start }
      },
      orderBy: { date: 'asc' }
    });

    const discipline = await this.statsHelper.computeDisciplineRate(user.employeeProfile.id, 30);
    const weeklySummary = this.statsHelper.computePeriodSummary(attendances);

    return {
      profile: {
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        phone: user.phone,
        email: user.email,
      },
      disciplineRate: {
        rate: discipline.rate,
        label: discipline.label,
      },
      weeklySummary: weeklySummary.summary,
      weeklyLog: weeklySummary.records,
    };
  }

  async getMyDisciplineRate(userId: string, days: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true }
    });
    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    return this.statsHelper.computeDisciplineRate(user.employeeProfile.id, days);
  }

  async update(MyId: string, updateEmployeeDto: UpdateEmployeeDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: MyId },
      data: {
        fullName: updateEmployeeDto.fullName,
        email: updateEmployeeDto.email,
        phone: updateEmployeeDto.phone,
        ...(updateEmployeeDto.jobTitle !== undefined && { jobTitle: updateEmployeeDto.jobTitle }),
      }
    });
    return updatedUser;
  }
}
