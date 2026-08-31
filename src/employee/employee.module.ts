import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { UtilityModule } from '../utilities/utilities.module';
import { CalculatePeriodService } from '../utilities/calculate-period.service';

@Module({
  imports: [UtilityModule],
  controllers: [EmployeeController],
  providers: [EmployeeService , CalculatePeriodService],
})
export class EmployeeModule {}

