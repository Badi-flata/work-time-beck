import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import {
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  differenceInMinutes,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PrismaService } from 'src/prisma/prisma.service';
import { AttendanceStatus, ExcuseType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { SubmitExcuseDto } from './dto/submit-excuse.dto';

const TZ = 'Asia/Riyadh';


@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * checkIn - تسجيل حضور الموظف
   * 1. جلب الملف الشخصي + الوردية
   * 2. منع التسجيل المزدوج لليوم نفسه
   * 3. حساب التأخير بناءً على gracePeriodMinIn (فترة السماح للحضور)
   * 4. إنشاء سجل الحضور بالحالة المناسبة (ON_TIME أو LATE)
   */
  async checkIn(employeeUserId: string) {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);

    // 1. جلب ملف الموظف والوردية
    const profile: any = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeUserId },
      include: { shift: true },
    });

    if (!profile || !profile.shift) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف أو الوردية المحددة');
    }

    // 2. منع التسجيل المزدوج
    const existing = await this.prisma.attendance.findUnique({
      where: { employeeProfileId_date: { employeeProfileId: profile.id, date: today } },
    });
    if (existing) throw new ConflictException('تم تسجيل الحضور مسبقاً لهذا اليوم');

    // 3. حساب التأخير عن بدء الوردية باستخدام gracePeriodMinIn
    const [sh, sm] = profile.shift.startTime.split(':').map(Number);
    const shiftStart = setMilliseconds(setSeconds(setMinutes(setHours(nowZoned, sh), sm), 0), 0);
    const diffMin = differenceInMinutes(nowZoned, shiftStart);

    // التأخير يُحسب فقط إن تجاوز فترة السماح للحضور
    const delayMinutes = diffMin > profile.shift.gracePeriodMinIn ? diffMin : 0;
    const status = delayMinutes > 0 ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;

    // 4. إنشاء سجل الحضور
    return this.prisma.attendance.create({
      data: {
        id: randomUUID(),
        date: today,
        checkIn: nowZoned,
        status,
        delayMinutes,
        employeeProfileId: profile.id,
      },
    });
  }

  /**
   * checkOut - تسجيل انصراف الموظف
   * 1. جلب الملف الشخصي + الوردية
   * 2. التحقق من وجود سجل حضور لليوم وعدم تسجيل الانصراف مسبقاً
   * 3. حساب إجمالي وقت العمل ودقائق المغادرة المبكرة
   */
  async checkOut(employeeUserId: string, employeeNote?: string) {
    const nowZoned = toZonedTime(Date.now(), TZ);
    const today = startOfDay(nowZoned);

    const profile: any = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeUserId },
      include: { shift: true },
    });

    if (!profile || !profile.shift) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف أو الوردية المحددة');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { employeeProfileId_date: { employeeProfileId: profile.id, date: today } },
    });

    if (!attendance) throw new NotFoundException('لم يتم تسجيل الحضور اليوم');
    if (attendance.checkOut) throw new ConflictException('تم تسجيل الانصراف مسبقاً');

    const [eh, em] = profile.shift.endTime.split(':').map(Number);
    const shiftEnd = setMilliseconds(setSeconds(setMinutes(setHours(nowZoned, eh), em), 0), 0);

    const totalWorked = Math.max(0, differenceInMinutes(nowZoned, attendance.checkIn!));
    const earlyLeave = nowZoned < shiftEnd ? differenceInMinutes(shiftEnd, nowZoned) : 0;

    return this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: nowZoned,
        totalWorkedMinutes: totalWorked,
        earlyLeaveMinutes: earlyLeave,
        ...(employeeNote !== undefined && { employeeNote }),
      },
    });
  }

  /**
   * submitExcuse - تقديم عذر
   */
  async submitExcuse(userId: string, dto: SubmitExcuseDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true }
    });
    if (!user || !user.employeeProfile) {
      throw new NotFoundException('لم يتم العثور على ملف الموظف');
    }

    const today = startOfDay(toZonedTime(Date.now(), TZ));

    let attendance: any = null;
    if (dto.attendanceId) {
      attendance = await this.prisma.attendance.findUnique({
        where: { id: dto.attendanceId }
      });
    } else {
      attendance = await this.prisma.attendance.findUnique({
        where: { employeeProfileId_date: { employeeProfileId: user.employeeProfile.id, date: today } }
      });
    }

    if (!attendance) {
      throw new NotFoundException('لم يتم العثور على سجل الحضور المرتبط');
    }

    const excuse = await this.prisma.excuse.create({
      data: {
        id: randomUUID(),
        reason: dto.reason,
        type: dto.type,
        attendanceId: attendance.id,
        submittedById: user.id,
        isApproved: false,
      }
    });

    if (dto.type === 'IN') {
      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { excuseReasonIn: dto.reason }
      });
    } else {
      await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: { excuseReasonOut: dto.reason }
      });
    }

    return excuse;
  }
} 