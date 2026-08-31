import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { StatisticsHelperService } from './statistics-helper.service';
import { CalculatePeriodService } from './calculate-period.service';


@Module({
  
  controllers: [],
  providers: [UtilitiesService, StatisticsHelperService, CalculatePeriodService],
  exports:  [UtilitiesService, StatisticsHelperService], 
})
export class UtilityModule {}