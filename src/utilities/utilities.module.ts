import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';


@Module({
  
  controllers: [],
  providers: [UtilitiesService],
  exports:  [UtilitiesService], 
})
export class UtilityModule {}