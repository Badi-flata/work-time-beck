import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty({ message: 'اسم القسم مطلوب' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  monthlyWorkingDays?: number;

  @IsOptional()
  @IsArray()
  weekendDays?: number[];

  @IsOptional()
  @IsNumber()
  monthlyHolidays?: number;

  @IsOptional()
  @IsNumber()
  latePenaltyAmount?: number;

  @IsOptional()
  @IsNumber()
  earlyLeavePenaltyAmount?: number;

  @IsOptional()
  @IsNumber()
  absentPenaltyAmount?: number;
}

