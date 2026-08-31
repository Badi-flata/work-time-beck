import { IsNumber, IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsOptional()
  managerName?: string;

  @IsNotEmpty({ message: 'اسم الوردية مطلوب' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'وقت بدء الوردية مطلوب' })
  @IsString()
  startTime: string;

  @IsNotEmpty({ message: 'وقت انتهاء الوردية مطلوب' })
  @IsString()
  endTime: string;

  @IsOptional()
  @IsNumber()
  @IsInt()
  gracePeriodMinIn?: number = 15;

  @IsOptional()
  @IsNumber()
  @IsInt()
  gracePeriodMinOut?: number = 30;

  @IsNotEmpty({ message: 'معرف القسم المرتبط مطلوب' })
  @IsString()
  departmentsId: string;
}
