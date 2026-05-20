import { Role } from "@prisma/client";
import { IsString, IsNotEmpty, IsDateString,IsEmail, IsEnum, IsUUID, IsOptional,IsBoolean } from 'class-validator';
import {ApiProperty } from '@nestjs/swagger'

// حقول الملف الشخصي — مطلوبة لواجهة "معلومات حسابي"
export class CreateUserDto { 

    @IsString()
    @IsNotEmpty()
    fullName :string

    @IsString()
    @IsNotEmpty()
    @IsEnum(Role) 
    role: Role;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    passwordHash: string;

    @IsString()
    @IsOptional()
    phone?: string; 

    @IsString()
    @IsOptional()
    departmentName?: string; 

}

