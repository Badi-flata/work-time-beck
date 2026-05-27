import { AttendanceStatus, Role } from "@prisma/client";
import { IsEmail, IsEnum, IsNumber, IsBoolean , IsNotEmpty , IsOptional, IsString } from "class-validator";

export class ManagingDto {
    @IsOptional()
    @IsEnum(AttendanceStatus)
    employeestatus?:AttendanceStatus

    @IsString()
    @IsOptional()
    employeeId?:string;
    
    @IsOptional()
    @IsString()
    managerId?:string;

    @IsEmail()
    @IsString()
    @IsOptional()
    email?:string;

    @IsString()
    @IsNotEmpty()
    phone?:string;

    @IsOptional()
    @IsNumber()
    salary?:number;

    @IsOptional()
    @IsBoolean()
    isWorking?:boolean;

    @IsOptional()
    @IsString()
    adminNotes?:string;

    @IsOptional()
    @IsString()
    attendanceId?:string;

    @IsOptional()
    @IsString()
    jobTitle?:string;
}

