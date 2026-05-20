import { Controller, Get, Query, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { shift } from './dto/shfit.dto';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Riyadh';

// الاسم الرئيسي للمسارات
// main path 
@Controller('managing')

// الحراس وصلاحيات الوصول
// authentication and authorization 
@Auth(Role.SUPER_ADMIN)
export class ManagingController {
  constructor(
    private readonly managingService: ManagingService,
    private readonly utility: UtilitiesService
  ) {}

  // GET /managing/dashboard?date=2026-05-18
  @Get('dashboard')
  async getDashboard(
    @CurrentUser('userId') userId: string,
    @Query('date') date?: string
  ) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    return this.utility.getDashboard(userId, date || defaultDate);
  }

  // إضافة عامل لدى المدير 
  // add worker to manager
  @Post('add-employee/:id')
  addworker(@Param('id') employeeUserId: string, @CurrentUser('userId') managerUserId: string) {
    return this.managingService.addworker(employeeUserId, managerUserId);
  }

  // جلب جميع العمال لدى المدير 
  // get all employees of manager 
  @Get('my-employees')
  getMyWorkers(@CurrentUser('userId') managerUserId: string) {
    return this.managingService.getMyWorkers(managerUserId);
  }

  @Post('make-a-shift')
  makeAShift(@Body() shift: shift) {
    return this.managingService.newShfit(shift);
  }

  // تدقيق العامل لدى المدير 
  // audit employee to manager  
  @Patch('audit-employee')
  update(
    @Query('email') email: string,
    @Query('employeeId') employeeId: string,
    @Body() audit: auditMyEmployeeDto
  ) {
    return this.managingService.handleAndAuditMyEmployees(email, employeeId, audit);
  }

  @Delete('delete-employee/:id')
  remove(@Param('id') id: string) {
    return this.managingService.removeEmployee(id);
  }

  // التقارير الأسبوعية والشهرية للمدير

  @Get('weekly-report')
  getWeeklyReport(@CurrentUser('userId') managerUserId: string, @Query('startDate') startDate: string) {
    return this.utility.latestWeekReport(managerUserId, startDate);
  }

  @Get('monthly-report')
  getMonthlyReport(@CurrentUser('userId') managerUserId: string, @Query('startDate') startDate: string) {
    return this.utility.latestMonthReport(managerUserId, startDate);
  }

  @Get('employee-weekly-report/:id')
  getEmployeeWeeklyReport(@Param('id') employeeUserId: string, @Query('startDate') startDate: string) {
    return this.utility.getAEmployeeWeeklyReport(employeeUserId, startDate);
  }

  @Get('employee-monthly-report/:id')
  getEmployeeMonthlyReport(@Param('id') employeeUserId: string, @Query('startDate') startDate: string) {
    return this.utility.getMonthlyReport(employeeUserId, startDate);
  }
}
