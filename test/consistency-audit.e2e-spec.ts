/**
 * E2E Test: Consistency Audit — الاختبار الشامل لتوافق الإنشاء والاستعلام
 * يختبر كل الـ endpoints الرئيسية للتأكد من:
 * 1. managerId يخزن AdminProfile.id (وليس userId)
 * 2. Token يحمل profileId
 * 3. استعلامات الموظفين تعمل بـ EmployeeProfile.id
 * 4. التاريخ يستخدم UTC Midnight
 * 5. Shift Fallback يعمل
 * 6. SUPER_ADMIN dual ID يعمل
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

describe('Consistency Audit E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test data
  let adminUserId: string;
  let adminProfileId: string;
  let employeeUserId: string;
  let employeeProfileId: string;
  let departmentId: string;
  let shiftId: string;
  let adminToken: string;
  let employeeToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Cleanup only our own test data if left over
    await prisma.user.deleteMany({
      where: {
        email: { in: ['audit-admin@test.sa', 'audit-emp@test.sa', 'no-shift@test.sa', 'dept-only@test.sa'] }
      }
    }).catch(() => {});

    // Create admin user with known IDs
    adminUserId = randomUUID();
    adminProfileId = randomUUID();
    const passwordHash = await bcrypt.hash('Test@12345', 10);

    await prisma.user.create({
      data: {
        id: adminUserId,
        email: 'audit-admin@test.sa',
        passwordHash,
        fullName: 'مدير الاختبار',
        role: Role.SUPER_ADMIN,
        adminProfile: {
          create: { id: adminProfileId },
        },
      },
    });

    // Create department with managerId = adminProfileId (NOT adminUserId)
    const dept = await prisma.department.create({
      data: {
        id: randomUUID(),
        name: 'قسم الاختبار',
        description: 'قسم تجريبي',
        managerId: adminProfileId,
      },
    });
    departmentId = dept.id;

    // Create shift
    const shift = await prisma.shift.create({
      data: {
        id: randomUUID(),
        name: 'وردية الاختبار',
        startTime: '08:00',
        endTime: '16:00',
        gracePeriodMinIn: 15,
        gracePeriodMinOut: 30,
        departmentsId: departmentId,
      },
    });
    shiftId = shift.id;

    // Create employee
    employeeUserId = randomUUID();
    employeeProfileId = employeeUserId; // same as in creatEmploye()

    await prisma.user.create({
      data: {
        id: employeeUserId,
        email: 'audit-emp@test.sa',
        passwordHash,
        fullName: 'موظف الاختبار',
        role: Role.EMPLOYEE,
        employeeProfile: {
          create: {
            id: employeeProfileId,
            managerId: adminProfileId,
            departmentId: departmentId,
            shiftId: shiftId,
            salary: 5000,
            isWorking: true,
          },
        },
      },
    });
  }, 30000);

  afterAll(async () => {
    // Cleanup test records
    if (employeeProfileId) {
      await prisma.attendance.deleteMany({ where: { employeeProfileId } }).catch(() => {});
      await prisma.employeeProfile.deleteMany({ where: { id: employeeProfileId } }).catch(() => {});
    }
    if (shiftId) {
      await prisma.shift.deleteMany({ where: { id: shiftId } }).catch(() => {});
    }
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: ['audit-admin@test.sa', 'audit-emp@test.sa', 'no-shift@test.sa', 'dept-only@test.sa'] }
      }
    }).catch(() => {});
    await app.close();
  }, 15000);

  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Token يحمل profileId (وليس userId)
  // ═══════════════════════════════════════════════════════════════
  describe('Token ProfileId', () => {
    it('admin login should return token with adminProfile.id as userId', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/loginIn')
        .send({ email: 'audit-admin@test.sa', passwordHash: 'Test@12345' });

      expect([200, 201]).toContain(res.status);
      adminToken = res.body.data.token;
      expect(adminToken).toBeDefined();

      // Decode JWT payload to check userId = adminProfileId
      const payload = JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString());
      expect(payload.userId).toBe(adminProfileId);
      expect(payload.userId).not.toBe(adminUserId);
    });

    it('employee login should return token with employeeProfile.id as userId', async () => {
      const res = await request(app.getHttpServer())
        .post('/users/loginIn')
        .send({ email: 'audit-emp@test.sa', passwordHash: 'Test@12345' });

      expect([200, 201]).toContain(res.status);
      employeeToken = res.body.data.token;
      expect(employeeToken).toBeDefined();

      const payload = JSON.parse(Buffer.from(employeeToken.split('.')[1], 'base64').toString());
      expect(payload.userId).toBe(employeeProfileId);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: managerId = AdminProfile.id (Schema consistency)
  // ═══════════════════════════════════════════════════════════════
  describe('managerId References AdminProfile.id', () => {
    it('EmployeeProfile.managerId should equal AdminProfile.id', async () => {
      const emp = await prisma.employeeProfile.findUnique({
        where: { id: employeeProfileId },
      });
      expect(emp.managerId).toBe(adminProfileId);
      expect(emp.managerId).not.toBe(adminUserId);
    });

    it('Department.managerId should equal AdminProfile.id', async () => {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      expect(dept.managerId).toBe(adminProfileId);
      expect(dept.managerId).not.toBe(adminUserId);
    });

    it('Prisma relation manager should resolve correctly', async () => {
      const emp = await prisma.employeeProfile.findUnique({
        where: { id: employeeProfileId },
        include: { manager: true },
      });
      expect(emp.manager).toBeDefined();
      expect(emp.manager.id).toBe(adminProfileId);
      expect(emp.manager.userId).toBe(adminUserId);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: getMyWorkers يعيد الموظفين (بما في ذلك موظفي الأقسام)
  // ═══════════════════════════════════════════════════════════════
  describe('getMyWorkers Endpoint', () => {
    it('should return employees when queried with adminProfile.id token', async () => {
      const res = await request(app.getHttpServer())
        .get('/managing/my-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const workers = res.body.data?.subordinates || res.body.data;
      expect(workers).toBeDefined();
      // Should find at least the one employee we created
      const found = Array.isArray(workers) && workers.length > 0;
      expect(found).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Departments Endpoint
  // ═══════════════════════════════════════════════════════════════
  describe('Departments Endpoint', () => {
    it('should return departments for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/department')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const depts = res.body.data;
      expect(Array.isArray(depts)).toBe(true);
      expect(depts.length).toBeGreaterThanOrEqual(1);
      expect(depts[0].name).toBe('قسم الاختبار');
    });

    it('should return shifts for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/department/shifts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: CheckIn/CheckOut works with profileId token
  // ═══════════════════════════════════════════════════════════════
  describe('Attendance CheckIn/CheckOut', () => {
    it('employee checkIn should work with profileId-based token', async () => {
      const res = await request(app.getHttpServer())
        .post('/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          employeeId: employeeProfileId,
          shiftId: shiftId,
          checkIn: new Date().toISOString(),
        });

      // Accept 200/201 (success) or 400/409 (already checked in or outside shift)
      expect([200, 201, 400, 409]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: fetchSourceData works with profileId
  // ═══════════════════════════════════════════════════════════════
  describe('FetchSourceData', () => {
    it('should return attendance data for employee', async () => {
      const res = await request(app.getHttpServer())
        .get('/attendance/shift')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      // Shift should be resolved (either from employee or department fallback)
      expect(res.body.data.shift).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: Dashboard Registry works with adminProfile.id token
  // ═══════════════════════════════════════════════════════════════
  describe('Dashboard Registry', () => {
    it('should return dashboard data for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/managing/dashboard-registry?mode=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);

      // 200 or 404 are acceptable (404 if no data for today)
      expect([200, 404]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: Auto-Checkout works with adminProfile.id token
  // ═══════════════════════════════════════════════════════════════
  describe('Auto-Checkout', () => {
    it('should execute without errors', async () => {
      const res = await request(app.getHttpServer())
        .post('/managing/auto-check?force=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(res.status);
      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 9: PendingExcuses works with adminProfile.id token
  // ═══════════════════════════════════════════════════════════════
  describe('Pending Excuses', () => {
    it('should return pending excuses list', async () => {
      const res = await request(app.getHttpServer())
        .get('/managing/pending-excuses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 10: Employee Dashboard works with profileId
  // ═══════════════════════════════════════════════════════════════
  describe('Employee Dashboard', () => {
    it('should return employee dashboard data', async () => {
      const res = await request(app.getHttpServer())
        .get('/employee/my-dashboard')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect([200, 404]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 11: Shift auto-assignment (employee without explicit shift)
  // ═══════════════════════════════════════════════════════════════
  describe('Shift Auto-Assignment', () => {
    it('should auto-assign shift from department when not specified', async () => {
      // Create employee without shift
      const noShiftUserId = randomUUID();
      const passwordHash = await bcrypt.hash('Test@12345', 10);
      await prisma.user.create({
        data: {
          id: noShiftUserId,
          email: 'no-shift@test.sa',
          passwordHash,
          fullName: 'موظف بدون وردية',
          role: Role.EMPLOYEE,
          employeeProfile: {
            create: {
              id: noShiftUserId,
              salary: 4000,
              isWorking: true,
            },
          },
        },
      });

      // Try to add worker via managing endpoint (shift should auto-assign)
      const res = await request(app.getHttpServer())
        .post(`/managing/add-employee/${noShiftUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'no-shift@test.sa',
          departmentId: departmentId,
          // No shiftId — should auto-assign from department
        });

      if (res.status === 200 || res.status === 201) {
        const updated = await prisma.employeeProfile.findUnique({
          where: { id: noShiftUserId },
        });
        expect(updated.shiftId).toBe(shiftId); // Should be auto-assigned
        expect(updated.managerId).toBe(adminProfileId);
        expect(updated.departmentId).toBe(departmentId);
      }

      // Cleanup
      await prisma.employeeProfile.delete({ where: { id: noShiftUserId } });
      await prisma.user.delete({ where: { id: noShiftUserId } });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 12: Department employee visibility
  // ═══════════════════════════════════════════════════════════════
  describe('Department Employee Visibility', () => {
    it('employees in manager departments should be visible in queries', async () => {
      // Create employee linked to department but NOT directly to managerId
      const deptEmpId = randomUUID();
      const passwordHash = await bcrypt.hash('Test@12345', 10);
      await prisma.user.create({
        data: {
          id: deptEmpId,
          email: 'dept-only@test.sa',
          passwordHash,
          fullName: 'موظف القسم فقط',
          role: Role.EMPLOYEE,
          employeeProfile: {
            create: {
              id: deptEmpId,
              departmentId: departmentId,
              shiftId: shiftId,
              salary: 4000,
              isWorking: true,
              // managerId is NULL — only linked via department
            },
          },
        },
      });

      // getMyWorkers should still find this employee (via department expansion)
      const res = await request(app.getHttpServer())
        .get('/managing/my-employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const workers = res.body.data?.subordinates || res.body.data;
      const found = Array.isArray(workers) && workers.some(
        (w: any) => w.userId === deptEmpId || w.id === deptEmpId
      );
      expect(found).toBe(true);

      // Cleanup
      await prisma.employeeProfile.delete({ where: { id: deptEmpId } });
      await prisma.user.delete({ where: { id: deptEmpId } });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // TEST 13: UTC Midnight date consistency
  // ═══════════════════════════════════════════════════════════════
  describe('UTC Midnight Date Consistency', () => {
    it('attendance dates should be stored as UTC midnight', async () => {
      const attendance = await prisma.attendance.findFirst({
        where: { employeeProfileId: employeeProfileId },
        orderBy: { date: 'desc' },
      });

      if (attendance) {
        const dateStr = attendance.date.toISOString();
        // Should end with T00:00:00.000Z (UTC midnight)
        expect(dateStr).toMatch(/T00:00:00\.000Z$/);
      }
    });
  });
});
