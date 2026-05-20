import { Injectable  ,ConflictException , NotFoundException} from '@nestjs/common';
import { startOfDay, setHours, setMinutes, setSeconds, setMilliseconds, differenceInMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Riyadh';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AttendanceStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
@Injectable()
export class AttendanceService {

constructor(private readonly prisma: PrismaService){ }

  async checkIn(employeeUserId: string) {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);

    // 1. جلب ملف الموظف والوردية
    const profile :any = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeUserId },
      include: {
         shift: true 
      }
    });

    // 2. منع التسجيل المزدوج
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeProfileId_date: { employeeProfileId: profile.id  , date: today } }
    });
    if (existing) throw new ConflictException('تم تسجيل الحضور مسبقاً');

    // 3. حساب الحالة والتأخير
    const [sh, sm] = profile.shift.startTime.split(':').map(Number);
    const shiftStart = setMilliseconds(setSeconds(setMinutes(setHours(nowZoned, sh), sm), 0), 0);
    const diffMin = differenceInMinutes(nowZoned, shiftStart);
    const delayMinutes = diffMin > profile.shift.gracePeriodMin ? diffMin : 0;
    const status = delayMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;

    // 4. إنشاء سجل الحضور
    return this.prisma.attendance.create({
      data: {
        id: randomUUID(),
        date: today,
        checkIn: nowZoned,
        status,
        delayMinutes,
        employeeProfileId: profile.id
      }
    });
  }

 
  async checkOut(employeeUserId: string) {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);

    const profile :any = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeUserId },
      include: {
         shift: true 
      }
    });

    // 2. منع التسجيل المزدوج
    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeProfileId_date: { employeeProfileId: profile.id  , date: today } }
    });
    
    if (!attendance) throw new NotFoundException('لم يتم تسجيل الحضور اليوم');
    if (attendance.checkOut) throw new ConflictException('تم تسجيل الانصراف مسبقاً');

    const [eh, em] = profile.shift.endTime.split(':').map(Number);
    const shiftEnd = setMilliseconds(setSeconds(setMinutes(setHours(nowZoned, eh), em), 0), 0);
    const totalWorked = differenceInMinutes(nowZoned, attendance.checkIn!);
    const earlyLeave = nowZoned < shiftEnd ? differenceInMinutes(shiftEnd, nowZoned) : 0;

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut: nowZoned, totalWorkedMinutes: totalWorked, earlyLeaveMinutes: earlyLeave }
    });
  }

}
