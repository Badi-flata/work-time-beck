import { Controller, Get, Post, Body, Patch, Delete } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Auth } from 'src/core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';

@Auth(Role.EMPLOYEE)
@Controller('attendance')
export class AttendanceController {

  constructor(private readonly attendanceService: AttendanceService) {}


  @Post('check-in')
  checkIn(@CurrentUser(['userId']) userId:string) {
    return this.attendanceService.checkIn(userId);
  }

  @Post('check-out')
  checkOut(@CurrentUser(['userId']) userId:string) {
    return this.attendanceService.checkOut(userId);
  }
}
