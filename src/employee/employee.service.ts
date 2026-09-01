import { Injectable } from '@nestjs/common';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';
import { startOfDay, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { EmployeeProfileNotFoundException, RecordAttendancesEmployeeUndefindExcepion } from '../core/domain-exceptions/employee.exceptions';
import { ManagerProfileNotFoundException } from '../core/domain-exceptions/department.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { CalculatePeriodService } from 'src/utilities/calculate-period.service';
import { Role } from '@prisma/client';

const TZ = 'Asia/Riyadh';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private statsHelper: StatisticsHelperService,
    private calculatePeriod: CalculatePeriodService,
  ) {}

  async addOrChangeManager(managerId: string, MyId: string) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { id: managerId }
    });
    if (!manager) throw new ManagerProfileNotFoundException();

    await this.prisma.employeeProfile.update({
      where: { userId: MyId },
      data: { managerId: managerId }
    });

    return ResponseHelper.success(null, 'تم تعيين المدير بنجاح');
  }

  async getMyDashboard(userId: string,mode:Modes,dateAnchor:string ,employeeId?:string) {

    const id = employeeId || userId
    const user = await this.prisma.employeeProfile.findFirst({
      where: {OR:  [ {userId:id} , {id:id}   ] },
      include: { 
        user: true, 
        shift:{select:{name:true}},
        department:{select:{name:true}} 
        , manager:{
          select:{
            user:{
              select:{
                fullName:true
              }
            }
          }
        }
      }
    });
    if (!user) {
      throw new EmployeeProfileNotFoundException();
    }

    

    const { periodLabel , startDate:start , endDate:end } = this.calculatePeriod.calculateMonthlyBoundedPeriod( mode , dateAnchor )
 
    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeProfileId:user.id,
        date: { gte: start , lt:end }
      },
      orderBy: { date: 'asc' } 
    });
     
    if (!attendances) throw new RecordAttendancesEmployeeUndefindExcepion();
   
    const expectedWorkingDays = this.statsHelper.calculateExpectedWorkingDays(start, end, {
      shift: user.shift as any,
      department: user.department as any,
    });

    const { summary, days, rate, label } = this.statsHelper.summarizeAttendances(attendances, expectedWorkingDays);
     
    const data = {
      periodLabel:periodLabel,
      messageSuccessd:'تم جلب لوحة معلومات الموظف بنجاح',
      profile: {
        imageProfile:user.user.imageProfile,
        fullName: user.user.fullName,
        jobTitle: user.user.jobTitle,
        phone: user.user.phone,
        email: user.user.email,
        salary:user.salary,
        managerName: user.manager?.user?.fullName || 'لست مدرجاً لدى مدير حالياً',
        departmentName: user.department?.name || 'لست مدرجاً لدى قسم حالياً',
        shift: user.shift?.name || 'لست مدرجاً لدى وردية حالياً',
      },
      disciplineRate: {
        rate,
        label,
        periodCountDiscipline:periodLabel,
      }  ,
      summary: summary,
      daysLog: days,
    };

    return ResponseHelper.success(data, 'تم جلب لوحة معلومات الموظف بنجاح');
  }

  async getMyDisciplineRate(userId: string, mode?: Modes, dateAnchor?: string, days?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true }
    });
    if (!user || !user.employeeProfile) {
      throw new EmployeeProfileNotFoundException();
    }

    const modeOrDays = days !== undefined ? days : (mode || Modes.MONTHLY);
    const result = await this.statsHelper.computeDisciplineRate(user.employeeProfile.id, modeOrDays, dateAnchor);
    return ResponseHelper.success(result, 'تم جلب معدل الانضباط بنجاح');
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
    return ResponseHelper.success(updatedUser, 'تم تحديث الملف الشخصي بنجاح');
  }
}
