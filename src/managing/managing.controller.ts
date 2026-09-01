import { Controller, Get, Query, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { Auth } from '../core/decorators/global.auth.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { AttendanceService } from '../attendance/attendance.service';



import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

const TZ = 'Asia/Riyadh';

// الاسم الرئيسي للمسارات
// main path 
@ApiTags('managing')
@ApiBearerAuth()
@Controller('managing')

// الحراس وصلاحيات الوصول
// authentication and authorization 
@Auth(Role.SUPER_ADMIN , Role.MANAGER)
export class ManagingController {
  constructor(
    private readonly managingService: ManagingService,
    private readonly utility: UtilitiesService,
    private readonly attend:AttendanceService,
    private readonly statsHelper: StatisticsHelperService,
  ) {}




  // إضافة عامل لدى المدير 
  // add worker to manager
  @Post('add-employee/:id')
  addworker(
    @CurrentUser('userId') managerUserId: string,
    @Body() dto: { 
      departmentId: string; 
      shiftId: string;
      name?: string; 
      email: string; 
      phone?: string; 
      jobTitle?: string; 
      salary?: number 
    },
    @Param('id') employeeUserId?: string,
  ) {
    return this.managingService.addworker( managerUserId, dto ,employeeUserId);
  }

  // إضافة عامل لدى المدير 
  // add worker to manager
  @Post('trune-to-department/:id')
  truneToDepartmentEmployee(
    @Param('id') employeeUserId: string,
    @CurrentUser('userId') managerUserId: string,
    @Body() { departmentId, shiftId }: { departmentId: string; shiftId: string; }
  ) {
    return this.managingService.truneToDepartmentEmployee( managerUserId, employeeUserId , departmentId, shiftId);
  }

  // جلب جميع العمال لدى المدير مع حساب الانضباط والتقييم الشامل
  // GET /managing/my-employees?page=1&limit=10&mode=MONTHLY&dateAnchor=2026-06-01&departmentId=...
  @Get('my-employees')
  getMyWorkers(
    @CurrentUser('userId') managerUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('mode') mode?: Modes,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.managingService.getMyWorkers(
      managerUserId,
      pageNumber,
      limitNumber,
      mode || Modes.MONTHLY,
      dateAnchor,
      departmentId,
    );
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

  @Delete('fired-employee/:id')
  fired(@Param('id') id: string) {
    return this.managingService.firedEmployee(id);
  }
  
  // لوحة التحكم الموحدة وسجلات حضور الموظفين للمدير
  // GET /managing/dashboard-registry?mode=ALL&dateAnchor=2026-05-30&page=1&limit=10&startDate=2026-05-01&endDate=2026-05-31
  @Get('dashboard-registry')
  async getDashboardRegistry(
    @CurrentUser('userId') userId: string,
    @Query('mode') mode:Modes,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('excludeBreakdown') excludeBreakdown?: string,
  ) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const exclude = excludeBreakdown === 'true';
    return this.utility.getDashboardRegistry(
      userId,
      mode,
      dateAnchor || defaultDate,
      pageNumber,
      limitNumber,
      startDate,
      endDate,
      status,
      exclude,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Period Report — مسار واحد للمدير (employee-bounded-report/:id)
  // تم حذف GET /managing/period-report المكرر
  // ═══════════════════════════════════════════════════════════════

  @Get('employee-bounded-report/:id')
  getEmployeeBoundedReport(
    @CurrentUser('userId') userId: string,
    @Param('id') employeeId: string,
    @Query('startDate') startDate?: string,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('mode') mode: Modes = Modes.WEEKLY,
  ) {
    const defaultDate = format(toZonedTime(Date.now(), TZ), 'yyyy-MM-dd');
    const anchor = startDate || dateAnchor || defaultDate;
    return this.utility.fetchPeriodReport(userId, anchor, mode, employeeId);
  }




  // GET /managing/discipline-rate/:employeeProfileId
  @Get('discipline-rate/:employeeProfileId')
  getDisciplineRate(
    @Param('employeeProfileId') id: string,
    @Query('mode') mode?: Modes,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('days') days?: string,
  ) {
    const modeOrDays = days ? parseInt(days, 10) : (mode || Modes.MONTHLY);
    return this.statsHelper.computeDisciplineRate(id, modeOrDays, dateAnchor);
  }

  // GET /managing/organization-discipline
  @Get('organization-discipline')
  getOrganizationDiscipline(
    @CurrentUser('userId') managerUserId: string,
    @Query('mode') mode?: Modes,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.statsHelper.computeOrganizationDiscipline(managerUserId, mode || Modes.MONTHLY, dateAnchor, departmentId);
  }

  // GET /managing/pending-excuses
  @Get('pending-excuses')
  getPendingExcuses(@CurrentUser('userId') managerUserId: string) {
    return this.managingService.getPendingExcuses(managerUserId);
  }

  // POST /managing/approve-excuse/:id
  @Post('approve-excuse/:id')
  approveExcuse(
    @Param('id') excuseId: string,
    @Body() body?: { adminNotes?: string }
  ) {
    return this.managingService.approveExcuse(excuseId, body?.adminNotes);
  }

  // POST /managing/reject-excuse/:id
  @Post('reject-excuse/:id')
  rejectExcuse(
    @Param('id') excuseId: string,
    @Body() body?: { adminNotes?: string }
  ) {
    return this.managingService.rejectExcuse(excuseId, body?.adminNotes);
  }

  // POST /managing/examine-excuse/:id
  @Post('examine-excuse/:id')
  examineExcuse(
    @Param('id') excuseId: string,
    @Body() body: { isApproved: boolean; adminNotes?: string }
  ) {
    return this.managingService.examineExcuse(excuseId, body);
  }

  // ─── الانصراف التلقائي (Cron / Admin trigger) ─────────────────
  // POST /managing/auto-checkout
  // يُشغَّل من قِبل المدير أو Cron Job بعد انتهاء الورديات + فترة السماح
  // يبحث عن كل موظف لم يسجّل انصرافه ويعالجه تلقائياً
  @Post('auto-check')
  runAutoCheckout(@CurrentUser('userId') userId: string) {
    return this.utility.automaticallyCheck(userId);
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
