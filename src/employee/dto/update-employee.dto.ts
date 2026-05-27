
import { IsString, IsNotEmpty, IsDateString,IsEmail, IsEnum, IsUUID, IsOptional,IsBoolean } from 'class-validator';
import {ApiProperty } from '@nestjs/swagger'

// حقول الملف الشخصي — مطلوبة لواجهة "معلومات حسابي"
export class UpdateEmployeeDto { 

    @IsString()
    @IsNotEmpty()
    fullName :string

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;


    @IsString()
    @IsOptional()
    phone?: string; 

    @IsString()
    @IsOptional()
    jobTitle?: string;
}

