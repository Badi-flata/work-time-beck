import { Role } from "@prisma/client";
import { IsString, IsNotEmpty, IsDateString,IsEmail, IsEnum, IsUUID, IsOptional,IsBoolean } from 'class-validator';
import {ApiProperty } from '@nestjs/swagger'

// حقول الملف الشخصي — مطلوبة لواجهة "معلومات حسابي"
export class EmployeeDto { 

    @IsString()
    @IsOptional()
    userId:string

    @IsString()
    @IsOptional()
    fullName? :string

   

    @IsString()
    @IsOptional()
    @IsEmail()
    email?: string;

  

    @IsString()
    @IsOptional()
    phone?: string; 

    @IsString()
    @IsOptional()
    managerId?: string;
}


