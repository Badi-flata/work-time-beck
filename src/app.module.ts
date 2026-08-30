import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ManagingModule } from './managing/managing.module';
import { EmployeeModule } from './employee/employee.module';
import { AttendanceModule } from './attendance/attendance.module';
import { UtilityModule } from './utilities/utilities.module';
import { AuthModule } from './core/auth/auth.module';
import { DepartmentModule } from './department/department.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ManagingModule,
    EmployeeModule,
    AttendanceModule,
    UtilityModule,
    DepartmentModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

