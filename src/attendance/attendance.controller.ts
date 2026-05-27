import { Controller, Get, Post, Body, Patch, Delete } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Auth } from 'src/core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
import { SubmitExcuseDto } from './dto/submit-excuse.dto';

@Auth(Role.EMPLOYEE)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // POST /attendance/check-in
  @Post('check-in')
  checkIn(@CurrentUser('userId') userId: string) {
    return this.attendanceService.checkIn(userId);
  }

  // POST /attendance/check-out
  @Post('check-out')
  checkOut(
    @CurrentUser('userId') userId: string,
    @Body() body?: { employeeNote?: string },
  ) {
    return this.attendanceService.checkOut(userId, body?.employeeNote);
  }

  // POST /attendance/submit-excuse
  @Post('submit-excuse')
  submitExcuse(
    @CurrentUser('userId') userId: string,
    @Body() dto: SubmitExcuseDto,
  ) {
    return this.attendanceService.submitExcuse(userId, dto);
  }
}

