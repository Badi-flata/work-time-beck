import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { Role } from "@prisma/client";
import { IsString, IsNotEmpty, IsDateString,IsEmail, IsEnum, IsUUID, IsOptional,IsBoolean } from 'class-validator';

export class UpdateUserDto {

    @IsString()
    @IsOptional()
    fullName?: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string; 
    
    @IsString()
    @IsOptional()
    departmentName?: string; 

    @IsString()
    @IsOptional()
    jobTitle?: string; 

    @IsString()
    @IsOptional()
    shiftName?: string; 

    @IsString()
    @IsOptional()
    status?: string;
    
    @IsString()
    @IsOptional()
    imageProfile?: string;
}

