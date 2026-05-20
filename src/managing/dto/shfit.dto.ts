import { IsEmail, IsEnum, IsNumber, IsBoolean , IsNotEmpty , IsOptional, IsString, IsInt } from "class-validator";

export class shift {
@IsNotEmpty()
@IsString()
name :string;


@IsNotEmpty()
@IsString()
startTime: string;

@IsNotEmpty()
@IsString()
endTime:string;

@IsNotEmpty()
@IsNumber()
@IsInt()
gracePeriodMin: number;

@IsNotEmpty()
@IsString()
departmentsId : string;

}