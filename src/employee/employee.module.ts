import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { UtilitiesService } from 'src/utilities/utilities.service';

@Module({
  controllers: [EmployeeController],
  providers: [EmployeeService, PrismaService, UtilitiesService],
})
export class EmployeeModule {}
