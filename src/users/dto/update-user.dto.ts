import { Role } from "@prisma/client";
import { IsString, IsNotEmpty, IsDateString, IsEmail, IsEnum, IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
    @ApiPropertyOptional({ description: 'الاسم الكامل الجديد للمستخدم' })
    @IsString()
    @IsOptional()
    fullName?: string;

    @ApiPropertyOptional({ description: 'البريد الإلكتروني الجديد' })
    @IsString()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({ description: 'رقم الهاتف الجديد' })
    @IsString()
    @IsOptional()
    phone?: string; 
    
    @ApiPropertyOptional({ description: 'اسم القسم الجديد للموظف' })
    @IsString()
    @IsOptional()
    departmentName?: string; 

    @ApiPropertyOptional({ description: 'المسمى الوظيفي الجديد للموظف' })
    @IsString()
    @IsOptional()
    jobTitle?: string; 

    @ApiPropertyOptional({ description: 'اسم الوردية الجديدة للموظف' })
    @IsString()
    @IsOptional()
    shiftName?: string; 

    @ApiPropertyOptional({ description: 'حالة الموظف الجديدة' })
    @IsString()
    @IsOptional()
    status?: string;
    
    @ApiPropertyOptional({ description: 'رابط الصورة الشخصية الجديد للمستخدم' })
    @IsString()
    @IsOptional()
    imageProfile?: string;
}


