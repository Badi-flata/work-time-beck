import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { parseISO, startOfDay, addDays, addMonths, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { diff } from 'util';
import { AttendanceStatus } from '@prisma/client';

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


  async salaryDeductionDaly(employeeId: string) {

    const employee :any = await this.prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: { shift: true, attendances: true }
    });

   const thisDayAttendance = employee.attendances?.find((a: any) => a.date.toISOString().startsWith(new Date().toISOString().split('T')[0]));
  
    const isExcusedIn: boolean = thisDayAttendance?.isExcusedIn || false;
    const isExcusedOut: boolean = thisDayAttendance?.isExcusedOut || false;
    const comingTime = thisDayAttendance?.delayMinutes || 0; // وقت التأخير من سجل الحضور اليومي
    const leavingTime = thisDayAttendance?.earlyLeaveMinutes || 0; // وقت المغادرة المبكرة من سجل الحضور اليومي

    const hourlyRate = 10; // مثال: 10 دولار في الساعة
    let  salaryDeduction = 0; // خصم الراتب الافتراضي

    let lateDeduction = 0
    let leavingDeduction = 0;

    if(isExcusedIn === false && comingTime > 0){
        lateDeduction = Math.max(0, (comingTime / 60) * hourlyRate); // خصم بناءً على الوقت المتأخر
    }

    
    if( isExcusedOut === false && leavingTime > 0){
        leavingDeduction = Math.max(0, (leavingTime / 60) * hourlyRate); // خصم بناءً على الوقت المتأخر
    }
    
      salaryDeduction = lateDeduction + leavingDeduction;
    
     const newSalary = employee?.salary ?  Math.trunc((employee?.salary || 100) - salaryDeduction): employee?.salary // تحديث الراتب مع ضمان عدم أن يصبح سالباً
    await this.prisma.employeeProfile.update({
      where: { id: employeeId },
      data: { 
            salary: newSalary ,
            salaryDeductions: salaryDeduction
          }
    });
  }


  async automaticalCheckOut() {
    // هذه الدالة يمكن تشغيلها كـ Cron Job في وقت محدد يومياً
    // تقوم بالبحث عن جميع الحضور الذين لم يسجلوا خروجهم حتى الآن وتسجيل خروج تلقائي لهم
    const admins :any= await this.prisma.adminProfile.findMany({
      include: {
        shfits:true,
        subordinates: {
          include: {
            attendances: {
              where: {
                checkOut: null
              }
            }
          }
        }
      }
    });

    // const howUncheckedOut = await this.prisma.attendance.findMany({
    //   where: {
    //     checkOut: null,
    //     }
    // });


    const nowZoned  = toZonedTime(Date.now(), TZ);
    const nowTime = nowZoned.getHours() * 60 + nowZoned.getMinutes(); // الوقت الحالي بالدقائق منذ منتصف الليل
    // فلترة للأشخص الذين لم يسجلوا وقت خرجهم بعد انتهاء الوردية + فترة السماح
    admins.forEach((admin :any )=> {
    admin.shfits.endTime= + admin.shfits.gracePeriodMinOut + parseInt(admin.shfits.endTime.split(':')[0]) * 60 + parseInt(admin.shfits.endTime.split(':')[1]);
    if(nowTime >= admin.shfits.endTime){
      return admin}else return null;
  })

  const hoewUnCkeckedOut = admins.flatMap((a:any) => a.subordinates).flatMap((s:any) => s.attendances).filter((att:any) => att.checkOut === null);

    for (const attendance of hoewUnCkeckedOut) {
      if (attendance.checkOut) continue; // تأكد أن الانصراف لم يتم تسجيله بعد

      if(attendance.isExcusedOut){
        await this.prisma.attendance.update({
          where: { id: attendance.id },
          data: { checkOut: nowZoned, status: AttendanceStatus.EXCUSED , adminNotes: 'تم تسجيل خروج تلقائي بسبب عدم تسجيل الانصراف' }
        });
      }else{
      const now: number = nowZoned.getTime();
      const hourlyRate = 10; // مثال: 10 دولار في الساعة
      let   salaryDeduction = 0; // خصم الراتب الافتراضي
      let leavingDeduction = 0;
        leavingDeduction = Math.max(0, (now / 60) * hourlyRate); // خصم بناءً على الوقت المتأخر
        salaryDeduction = leavingDeduction;

      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { checkOut: nowZoned, status: AttendanceStatus.ESCAPY, adminNotes: 'تم تسجيل خروج تلقائي بسبب عدم تسجيل الانصراف' }
      });
    }
  }
}

}