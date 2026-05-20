import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaService } from './prisma/prisma.service';
import { ManagingModule } from './managing/managing.module';
import { EmployeeModule } from './employee/employee.module';
import { AttendanceModule } from './attendance/attendance.module';
import { UtilityModule } from './utilities/utilities.module';

@Module({
  imports: [
    UsersModule, ManagingModule,
     EmployeeModule, AttendanceModule
      ,UtilityModule
    ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
