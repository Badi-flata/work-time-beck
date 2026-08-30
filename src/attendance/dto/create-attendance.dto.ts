import { IsString, IsNotEmpty, IsOptional, IsObject, IsDate } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInExcuseDto {
  @ApiProperty({ enum: ['LATE', 'ABSENT'], description: 'نوع العذر' })
  type: 'LATE' | 'ABSENT';

  @ApiProperty({ description: 'سبب العذر' })
  reason: string;
}

export class CheckInDto {
  @ApiProperty({ description: 'معرف الوردية المرتبطة' })
  @IsNotEmpty()
  @IsString()
  shiftId: string;

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

  @ApiPropertyOptional({ type: CheckInExcuseDto, description: 'تفاصيل العذر إن وجد' })
  @IsOptional()
  @IsObject()
  excused?: CheckInExcuseDto;
}

export class CheckOutExcuseDto {
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

  @ApiPropertyOptional({ description: 'معرف الموظف' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ description: 'معرف الوردية' })
  @IsNotEmpty()
  @IsString()
  shiftId: string;

  @ApiProperty({ description: 'تاريخ ووقت تسجيل الانصراف' })
  @IsNotEmpty()
  checkOut: Date;

  @ApiPropertyOptional({ description: 'ملاحظات إضافية' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: CheckOutExcuseDto, description: 'تفاصيل العذر إن وجد' })
  @IsOptional()
  @IsObject()
  excused?: CheckOutExcuseDto;
}

export class CreateAttendanceDto extends CheckInDto {}
