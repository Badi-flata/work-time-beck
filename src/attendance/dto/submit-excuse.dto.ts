import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

// أنواع الأعذار
enum ExcuseType {
  IN = 'IN',
  OUT = 'OUT',
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
}
