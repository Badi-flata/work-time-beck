import { IsNumber, IsNotEmpty, IsString, IsInt, IsOptional } from "class-validator";

export class shift {
  @IsString()
  @IsOptional()
  managerName?: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  startTime: string;

  @IsNotEmpty()
  @IsString()
  endTime: string;

  // فترة السماح عند الحضور (بالدقائق)
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  gracePeriodMinIn: number;

  // فترة السماح عند الانصراف (بالدقائق)
  @IsNotEmpty()
  @IsNumber()
  @IsInt()
  gracePeriodMinOut: number;

  @IsNotEmpty()
  @IsString()
  departmentsId: string;
}