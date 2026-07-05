import { Controller, Get, Post, Body, Patch, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../core/decorators/currntUser.decorator';
import { SubmitExcuseDto } from './dto/submit-excuse.dto';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { UtilitiesService } from '../utilities/utilities.service';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsDate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

const TZ = 'Asia/Riyadh';

export class CheckInExcuse {
  @ApiProperty({ enum: ['LATE', 'ABSENT'], description: 'نوع العذر' })
  type: 'LATE' | 'ABSENT';

  @ApiProperty({ description: 'سبب العذر' })
  reason: string;
}

export class CheckInDto {
  @ApiProperty({ description: 'معرف الوردية المرتبطة' })
  @IsNotEmpty()
  @IsString()
  shifId: string;

  @ApiProperty({ description: 'معرف الموظف' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({ description: 'تاريخ ووقت تسجيل الحضور بتنسيق ISO 8601' })
  @IsNotEmpty()
  checkIn: string;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: CheckInExcuse, description: 'تفاصيل العذر إن وجد' })
  @IsOptional()
  @IsObject()
  excused?: CheckInExcuse;
}

export class CheckOutExcuse {
  @ApiProperty({ enum: ['EARLY_DEPARTURE', 'ABSENT'], description: 'نوع العذر' })
  type: 'EARLY_DEPARTURE' | 'ABSENT';

  @ApiProperty({ description: 'سبب العذر' })
  reason: string;
}

export class CheckOutDto {
  @ApiProperty({ description: 'معرف سجل الحضور الفعلي لتسجيل الانصراف منه' })
  @IsNotEmpty()
  @IsString()
  attendId: string;

  @ApiPropertyOptional({ description: 'معرف الموظف (اختياري، يتم الاستعانة بـ CurrentUser في حال عدم تقديمه)' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ description: 'معرف الوردية' })
  @IsNotEmpty()
  @IsString()
  shifId: string;

  @ApiProperty({ description: 'تاريخ ووقت تسجيل الانصراف' })
  @IsNotEmpty()
  checkOut: Date;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: CheckOutExcuse, description: 'تفاصيل العذر إن وجد' })
  @IsOptional()
  @IsObject()
  excused?: CheckOutExcuse;
}


@ApiTags('attendance')
@ApiBearerAuth()
@Auth(Role.EMPLOYEE ,Role.SUPER_ADMIN)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService
    ,private readonly utility: UtilitiesService
  ) {}

    @Post('check-in')
    checkIn(
      @CurrentUser('userId') userId: string,
      @Body() body: CheckInDto,
    ) {
    return this.attendanceService.checkIn(
        body.employeeId ,
        body.shifId,
        body.checkIn,
        body.notes,
        body.excused,
      );
    }

    @Post('check-out')
    checkOut(
      @CurrentUser('userId') userId: string,
      @Body() body: CheckOutDto,
    ) {
      const Id = body.employeeId || userId ;
      return this.attendanceService.checkOut(
        Id,
        body.attendId,
        body.shifId,
        new Date(body.checkOut),
        body.notes,
        body.excused,
      );
    }

    @Get("shift")
    getShiftData(
      @CurrentUser('userId') userId: string,
      @Query('employeeId') employeeId?: string,
      @Query('date') date?: string,
    ){
      return this.attendanceService.fetchSourceData(userId, employeeId,date);
    }

     @Get('bounded-period-report')
  getBoundedPeriodReport(
    @CurrentUser('userId') userId: string,
    @Query('dateAnchor') dateAnchor?: string , 
    @Query('mode') mode: Modes = Modes.WEEKLY,
    @Query('employeeId') employeeId?: string,
  ) {
        const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
        dateAnchor = dateAnchor || defaultDate;
    return this.utility.fetchBoundedPeriodReport(userId, dateAnchor, mode, employeeId);
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

