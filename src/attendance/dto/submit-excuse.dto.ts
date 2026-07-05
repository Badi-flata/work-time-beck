import { IsNotEmpty, IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

// أنواع الأعذار
enum ExcuseType {
  LATE = 'LATE',
  ABSENT = 'ABSENT',
  EARLY_DEPARTURE = 'EARLY_DEPARTURE',
}

export class SubmitExcuseDto {
  @IsNotEmpty({ message: 'سبب العذر مطلوب' })
  @IsString()
  reason: string;

  @IsNotEmpty({ message: 'نوع العذر مطلوب (IN أو OUT)' })
  @IsEnum(ExcuseType, { message: 'نوع العذر يجب أن يكون IN أو OUT' })
  type: ExcuseType;

  @IsOptional()
  @IsString()
  attendanceId?: string;


  @IsBoolean()
  isApproved: boolean;
}
