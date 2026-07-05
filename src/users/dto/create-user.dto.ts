import { Role } from "@prisma/client";
import { IsString, IsNotEmpty, IsDateString, IsEmail, IsEnum, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto { 
    @ApiProperty({ description: 'الاسم الكامل للمستخدم', example: 'احمد علي' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ enum: Role, description: 'دور المستخدم في النظام (SUPER_ADMIN, MANAGER, EMPLOYEE)', example: Role.EMPLOYEE })
    @IsString()
    @IsNotEmpty()
    @IsEnum(Role) 
    role: Role;

    @ApiProperty({ description: 'البريد الإلكتروني الفريد للمستخدم', example: 'employee@worktime.sa' })
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'كلمة المرور المشفرة أو كلمة المرور العادية أثناء التسجيل' })
    @IsString()
    @IsNotEmpty()
    passwordHash: string;

    @ApiPropertyOptional({ description: 'رقم الهاتف الخاص بالموظف', example: '0567890123' })
    @IsString()
    @IsOptional()
    phone?: string; 

    @ApiProperty({ description: 'اسم القسم الذي ينتمي إليه الموظف', example: 'الموارد البشرية' })
    @IsString()
    @IsNotEmpty()
    departmentName: string; 

    @ApiProperty({ description: 'المسمى الوظيفي للموظف', example: 'مهندس برمجيات' })
    @IsString()
    @IsNotEmpty()
    jobTitle: string; 
}


