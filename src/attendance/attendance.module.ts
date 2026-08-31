import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { UtilityModule } from '../utilities/utilities.module';

@Module({
  imports: [UtilityModule],
  controllers: [AttendanceController],
  exports: [AttendanceService],
  providers: [AttendanceService],
})
export class AttendanceModule {}
