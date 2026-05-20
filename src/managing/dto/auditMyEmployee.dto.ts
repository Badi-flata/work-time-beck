import { PartialType } from '@nestjs/swagger';
import { ManagingDto } from './managing.dto';
import { IsOptional, IsString } from 'class-validator';

export class auditMyEmployeeDto extends PartialType(ManagingDto) {
    @IsOptional()
    @IsString()
    shiftId?:string;
}
