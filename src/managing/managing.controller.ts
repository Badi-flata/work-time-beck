import { Controller, Get, Query, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { shift } from './dto/shfit.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';



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
    private readonly utility: UtilitiesService,
    private readonly statsHelper: StatisticsHelperService,
  ) {}

  // GET /managing/dashboard?date=2026-05-18&status=LATE
  @Get('dashboard')
  async getDashboard(
    @CurrentUser('userId') userId: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    return this.utility.getDashboard(userId, date || defaultDate, status);
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
  getMyWorkers(
    @CurrentUser('userId') managerUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.managingService.getMyWorkers(managerUserId, pageNumber, limitNumber);
  }

  @Post('make-a-shift')
  makeAShift(@Body() shift: shift) {
    return this.managingService.newShfit(shift);
  }

  // GET /managing/shifts
  @Get('shifts')
  getShifts(@CurrentUser('userId') managerUserId: string) {
    return this.managingService.getShifts(managerUserId);
  }

  // PATCH /managing/shifts/:id
  @Patch('shifts/:id')
  updateShift(@Param('id') shiftId: string, @Body() dto: UpdateShiftDto) {
    return this.managingService.updateShift(shiftId, dto);
  }

  // DELETE /managing/shifts/:id
  @Delete('shifts/:id')
  deleteShift(@Param('id') shiftId: string) {
    return this.managingService.deleteShift(shiftId);
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

  // لوحة التحكم الموحدة وسجلات حضور الموظفين للمدير
  // GET /managing/dashboard-registry?mode=daily&dateAnchor=2026-05-30
  @Get('dashboard-registry')
  async getDashboardRegistry(
    @CurrentUser('userId') userId: string,
    @Query('mode') mode: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('dateAnchor') dateAnchor?: string,
  ) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    return this.utility.getDashboardRegistry(userId, mode, dateAnchor || defaultDate);
  }

  @Get('employee-weekly-report/:id')
  getEmployeeWeeklyReport(@Param('id') employeeUserId: string, @Query('startDate') startDate: string) {
    return this.utility.getAEmployeeWeeklyReport(employeeUserId, startDate);
  }

  @Get('employee-monthly-report/:id')
  getEmployeeMonthlyReport(@Param('id') employeeUserId: string, @Query('startDate') startDate: string) {
    return this.utility.getMonthlyReport(employeeUserId, startDate);
  }

  // GET /managing/discipline-rate/:employeeProfileId
  @Get('discipline-rate/:employeeProfileId')
  getDisciplineRate(
    @Param('employeeProfileId') id: string,
    @Query('days') days?: string,
  ) {
    return this.statsHelper.computeDisciplineRate(id, days ? parseInt(days, 10) : 30);
  }

  // GET /managing/pending-excuses
  @Get('pending-excuses')
  getPendingExcuses(@CurrentUser('userId') managerUserId: string) {
    return this.managingService.getPendingExcuses(managerUserId);
  }

  // POST /managing/approve-excuse/:id
  @Post('approve-excuse/:id')
  approveExcuse(@Param('id') excuseId: string) {
    return this.managingService.approveExcuse(excuseId);
  }

  // ─── الانصراف التلقائي (Cron / Admin trigger) ─────────────────
  // POST /managing/auto-checkout
  // يُشغَّل من قِبل المدير أو Cron Job بعد انتهاء الورديات + فترة السماح
  // يبحث عن كل موظف لم يسجّل انصرافه ويعالجه تلقائياً
  @Post('auto-checkout')
  runAutoCheckout() {
    return this.utility.automaticallyCheckOut();
  }

  // ─── خصم الراتب اليومي ────────────────────────────────────────
  // POST /managing/salary-deduction/:employeeId
  // يُطبَّق الخصم اليومي بناءً على سجل الحضور (تأخر، مغادرة مبكرة، ESCAPY)
  // يُجمع الخصم على salaryDeduction التراكمي دون المساس بـ salary الأساسي
  @Post('salary-deduction/:employeeId')
  applySalaryDeduction(@Param('employeeId') employeeId: string) {
    return this.utility.salaryDeductionDaily(employeeId);
  }
}
