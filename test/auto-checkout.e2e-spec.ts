import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/core/auth/auth.service';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { Role, AttendanceStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Riyadh';

describe('Automatic Check & Auto-Checkout Engine (E2E & Integration Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let utilitiesService: UtilitiesService;

  let managerUser: any;
  let managerToken: string;
  let testDepartment: any;
  let endedShift: any;
  let employee1User: any;
  let employee2User: any;
  let employee3User: any;

  const cleanupIds: { users: string[]; departments: string[]; shifts: string[] } = {
    users: [],
    departments: [],
    shifts: [],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    utilitiesService = app.get(UtilitiesService);

    const nowZoned = toZonedTime(Date.now(), TZ);
    const todayStr = format(nowZoned, 'yyyy-MM-dd');
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);

    // 1. إنشاء مدير اختبار
    const managerUserId = randomUUID();
    const adminProfileId = randomUUID();
    cleanupIds.users.push(managerUserId);

    managerUser = await prisma.user.create({
      data: {
        id: managerUserId,
        email: `test-mgr-${Date.now()}@worktime.io`,
        fullName: 'مدير الفحص الآلي التجريبي',
        passwordHash: 'hashed_password',
        role: Role.MANAGER,
        phone: '0555555555',
        adminProfile: {
          create: {
            id: adminProfileId,
            autoCheckoutEnabled: true,
            isActiveDeduction: true,
            absentDeductionEnabled: true,
            earlyLeaveDeductionEnabled: true,
            combineDeductionsOnEndShift: true,
          },
        },
      },
    });

    const tokenPair = await authService.generateTokenPair(
      managerUser.fullName,
      adminProfileId,
      managerUser.role,
      managerUser.id,
    );
    managerToken = tokenPair.access_token;

    // 2. إنشاء قسم للاختبار (عطلة 99 لضمان عدم تخطي فحص الغياب)
    const deptId = randomUUID();
    cleanupIds.departments.push(deptId);

    testDepartment = await prisma.department.create({
      data: {
        id: deptId,
        name: `قسم الاختبار الآلي ${Date.now()}`,
        monthlyWorkingDays: 22,
        weekendDays: [99],
        managerId: adminProfileId,
      },
    });

    // 3. إنشاء وردية عمل منتهية للاختبار
    const shiftId = randomUUID();
    cleanupIds.shifts.push(shiftId);

    endedShift = await prisma.shift.create({
      data: {
        id: shiftId,
        name: 'وردية منتهية للاختبار',
        startTime: '06:00',
        endTime: '07:00',
        gracePeriodMinIn: 5,
        gracePeriodMinOut: 5,
        departmentsId: testDepartment.id,
      },
    });

    // 4. إنشاء الموظف 1: لديه حضور مفتوح (سجل دخول ولم يسجل خروج)
    const emp1UserId = randomUUID();
    cleanupIds.users.push(emp1UserId);

    employee1User = await prisma.user.create({
      data: {
        id: emp1UserId,
        email: `emp1-${Date.now()}@worktime.io`,
        fullName: 'موظف سجل دخول ولم ينصرف',
        passwordHash: 'hashed_password',
        role: Role.EMPLOYEE,
        phone: '0511111111',
        employeeProfile: {
          create: {
            id: emp1UserId,
            departmentId: testDepartment.id,
            shiftId: endedShift.id,
            managerId: adminProfileId,
            isWorking: true,
            salary: 6000,
          },
        },
      },
      include: { employeeProfile: true },
    });

    await prisma.attendance.create({
      data: {
        id: randomUUID(),
        date: todayDate,
        checkIn: new Date(todayDate.getTime() + 6 * 60 * 60 * 1000),
        checkOut: null,
        status: AttendanceStatus.ON_TIME,
        employeeProfileId: employee1User.employeeProfile.id,
        shiftId: endedShift.id,
        shiftName: endedShift.name,
        shiftStart: endedShift.startTime,
        shiftEnd: endedShift.endTime,
        graceIn: endedShift.gracePeriodMinIn,
        graceOut: endedShift.gracePeriodMinOut,
      },
    });

    // 5. إنشاء الموظف 2: لم يسجل أي حضور اليوم إطلاقاً (غائب)
    const emp2UserId = randomUUID();
    cleanupIds.users.push(emp2UserId);

    employee2User = await prisma.user.create({
      data: {
        id: emp2UserId,
        email: `emp2-${Date.now()}@worktime.io`,
        fullName: 'موظف غائب لم يسجل دخول',
        passwordHash: 'hashed_password',
        role: Role.EMPLOYEE,
        phone: '0522222222',
        employeeProfile: {
          create: {
            id: emp2UserId,
            departmentId: testDepartment.id,
            shiftId: endedShift.id,
            managerId: adminProfileId,
            isWorking: false,
            salary: 5000,
          },
        },
      },
      include: { employeeProfile: true },
    });

    // 6. إنشاء الموظف 3: وردية موروثة من القسم (shiftId: null)
    const emp3UserId = randomUUID();
    cleanupIds.users.push(emp3UserId);

    employee3User = await prisma.user.create({
      data: {
        id: emp3UserId,
        email: `emp3-${Date.now()}@worktime.io`,
        fullName: 'موظف بوردية موروثة من القسم',
        passwordHash: 'hashed_password',
        role: Role.EMPLOYEE,
        phone: '0533333333',
        employeeProfile: {
          create: {
            id: emp3UserId,
            departmentId: testDepartment.id,
            shiftId: null,
            managerId: adminProfileId,
            isWorking: false,
            salary: 4500,
          },
        },
      },
      include: { employeeProfile: true },
    });
  });

  afterAll(async () => {
    for (const userId of cleanupIds.users) {
      await prisma.refreshSession.deleteMany({ where: { userId } }).catch(() => {});
      const emp = await prisma.employeeProfile.findUnique({ where: { userId } }).catch(() => null);
      if (emp) {
        await prisma.attendance.deleteMany({ where: { employeeProfileId: emp.id } }).catch(() => {});
        await prisma.employeeProfile.delete({ where: { id: emp.id } }).catch(() => {});
      }
      await prisma.adminProfile.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }

    for (const shiftId of cleanupIds.shifts) {
      await prisma.shift.delete({ where: { id: shiftId } }).catch(() => {});
    }

    for (const deptId of cleanupIds.departments) {
      await prisma.department.delete({ where: { id: deptId } }).catch(() => {});
    }

    await app.close();
  });

  describe('1. 🔍 Service-Level Execution of automaticallyCheck', () => {
    it('should detect unclosed checkouts, absent employees, and fallback shifts without returning 0', async () => {
      const result = await utilitiesService.automaticallyCheck(managerUser.id, true);

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(result.results)).toBe(true);

      const outcomes = result.results.map((r) => r.outcome);
      expect(outcomes).toContain('ESCAPY');
      expect(outcomes).toContain('ABSENT');
    });

    it('should have updated employee1 (open attendance) to ESCAPY, closed checkOut, and set isWorking to false', async () => {
      const updatedEmp1 = await prisma.employeeProfile.findUnique({
        where: { id: employee1User.employeeProfile.id },
        include: { attendances: true },
      });

      expect(updatedEmp1!.isWorking).toBe(false);

      const closedAtt = updatedEmp1!.attendances[0];
      expect(closedAtt.checkOut).not.toBeNull();
      expect(closedAtt.status).toBe(AttendanceStatus.ESCAPY);
    });

    it('should have created an ABSENT attendance record for employee2 (never checked in)', async () => {
      const updatedEmp2 = await prisma.employeeProfile.findUnique({
        where: { id: employee2User.employeeProfile.id },
        include: { attendances: true },
      });

      expect(updatedEmp2!.attendances.length).toBeGreaterThanOrEqual(1);
      const absentAtt = updatedEmp2!.attendances.find(
        (a) => a.status === AttendanceStatus.ABSENT,
      );
      expect(absentAtt).toBeDefined();
      expect(absentAtt?.adminNotes).toContain('غياب تلقائي');
    });

    it('should have processed employee3 using the department shift fallback', async () => {
      const updatedEmp3 = await prisma.employeeProfile.findUnique({
        where: { id: employee3User.employeeProfile.id },
        include: { attendances: true },
      });

      expect(updatedEmp3!.attendances.length).toBeGreaterThanOrEqual(1);
      const absentAtt = updatedEmp3!.attendances.find(
        (a) => a.status === AttendanceStatus.ABSENT,
      );
      expect(absentAtt).toBeDefined();
      expect(absentAtt?.shiftName).toBe(endedShift.name);
    });
  });

  describe('2. 🌐 HTTP API Endpoint Verification: POST /managing/auto-check', () => {
    it('should return unified success response via HTTP when manager triggers auto-check', async () => {
      const response = await request(app.getHttpServer())
        .post('/managing/auto-check?force=true')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('statusCode', 200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('processed');
      expect(response.body.data).toHaveProperty('results');
    });

    it('should reject unauthorized calls to /managing/auto-check without manager token', async () => {
      await request(app.getHttpServer())
        .post('/managing/auto-check')
        .expect(401);
    });
  });
});
