import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './core/auth/auth.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const authService = app.get(AuthService);

  console.log('--- بدء تهيئة قاعدة البيانات بالبيانات التجريبية ---');

  try {
    // 1. تنظيف البيانات القديمة (لتفادي أي تعارض في البيانات الفريدة عند التشغيل المكرر)
    console.log('جاري تهيئة وتنظيف الجداول...');
    await prisma.attendance.deleteMany({});
    await prisma.employeeProfile.deleteMany({});
    await prisma.shift.deleteMany({});
    await prisma.department.deleteMany({});
    await prisma.adminProfile.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('تنظيف الجداول بنجاح.');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 2. إنشاء مستخدم المدير (SUPER_ADMIN)
    const managerUserId = randomUUID();
    const adminProfileId = randomUUID();
    console.log('جاري إنشاء مستخدم وملف المدير...');
    const managerUser = await prisma.user.create({
      data: {
        id: managerUserId,
        email: 'manager@example.com',
        fullName: 'البراء المدير',
        passwordHash,
        role: Role.SUPER_ADMIN,
        phone: '0501234567',
        adminProfile: {
          create: {
            id: adminProfileId,
          },
        },
      },
    });
    console.log(`تم إنشاء المدير بنجاح: ${managerUser.fullName} (ID: ${managerUserId})`);

    // 3. إنشاء القسم التابع للمدير
    const departmentId = randomUUID();
    console.log('جاري إنشاء قسم تقنية المعلومات (IT Department)...');
    const department = await prisma.department.create({
      data: {
        id: departmentId,
        name: 'IT Department',
        managerId: adminProfileId,
      },
    });
    console.log(`تم إنشاء القسم بنجاح: ${department.name} (ID: ${departmentId})`);

    // 4. إنشاء وردية عمل للقسم (Shift)
    const shiftId = randomUUID();
    console.log('جاري إنشاء وردية العمل الصباحية (Morning Shift)...');
    const shift = await prisma.shift.create({
      data: {
        id: shiftId,
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '16:00',
        gracePeriodMinIn: 15,
        gracePeriodMinOut: 30,
        departmentsId: departmentId,
      },
    });
    console.log(`تم إنشاء وردية العمل بنجاح: ${shift.name} (ID: ${shiftId})`);

    // 5. إنشاء مستخدم الموظف (EMPLOYEE)
    const employeeUserId = randomUUID();
    const employeeProfileId = randomUUID();
    console.log('جاري إنشاء مستخدم وملف الموظف...');
    const employeeUser = await prisma.user.create({
      data: {
        id: employeeUserId,
        email: 'employee@example.com',
        fullName: 'أحمد الموظف',
        passwordHash,
        role: Role.EMPLOYEE,
        phone: '0507654321',
        employeeProfile: {
          create: {
            id: employeeProfileId,
            departmentId: departmentId,
            shiftId: shiftId,
            managerId: adminProfileId,
            isWorking: true,
            salary: 5000,
          },
        },
      },
    });
    console.log(`تم إنشاء الموظف بنجاح: ${employeeUser.fullName} (ID: ${employeeUserId})`);

    // 6. توليد الـ Access Token للمدير
    console.log('جاري توليد رمز الوصول (Access Token) للمدير...');
    const tokenResult = await authService.generateTokenPair(
      managerUser.fullName,
      managerUserId,
      Role.SUPER_ADMIN
    );

    console.log('\n==================================================');
    console.log('🎉 تم إنشاء البيانات التجريبية بنجاح!');
    console.log('==================================================');
    console.log('🔑 بيانات تسجيل دخول المدير (SUPER_ADMIN):');
    console.log(`- البريد الإلكتروني: manager@example.com`);
    console.log(`- كلمة المرور:      password123`);
    console.log('\n👷 بيانات تسجيل دخول الموظف (EMPLOYEE):');
    console.log(`- البريد الإلكتروني: employee@example.com`);
    console.log(`- كلمة المرور:      password123`);
    console.log('\n🎫 رمز الوصول للمدير (SUPER_ADMIN Access Token):');
    console.log(`Bearer ${tokenResult.access_token}`);
    console.log('==================================================\n');

  } catch (error) {
    console.error('❌ حدث خطأ أثناء تهيئة البيانات التجريبية:', error);
  } finally {
    await app.close();
  }
}

bootstrap();
