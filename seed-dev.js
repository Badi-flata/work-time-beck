const { PrismaClient, Role, AttendanceStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB Seed...');

  // 1. Create Admin User
  const passwordHash = await bcrypt.hash('Admin@2026', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@worktime.sa' },
    update: {},
    create: {
      email: 'admin@worktime.sa',
      passwordHash,
      fullName: 'أحمد الإداري',
      jobTitle: 'مدير النظام',
      role: Role.SUPER_ADMIN,
      phone: '0500000000',
    },
  });
  console.log('Admin User created:', adminUser.email);

  // 2. Create AdminProfile
  const adminProfile = await prisma.adminProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
    },
  });
  console.log('AdminProfile created');

  // 3. Create Department
  const department = await prisma.department.upsert({
    where: { name: 'الإدارة العامة' },
    update: {},
    create: {
      name: 'الإدارة العامة',
      description: 'القسم الرئيسي',
      managerId: adminProfile.id,
    },
  });
  console.log('Department created:', department.name);

  // 4. Create Shift
  // Assume we might have multiple, just create one if not exists
  let shift = await prisma.shift.findFirst({ where: { name: 'الوردية الصباحية' } });
  if (!shift) {
    shift = await prisma.shift.create({
      data: {
        name: 'الوردية الصباحية',
        startTime: '08:00',
        endTime: '16:00',
        gracePeriodMinIn: 15,
        gracePeriodMinOut: 30,
        departmentsId: department.id,
      },
    });
  }
  console.log('Shift created:', shift.name);

  // 5. Create Mock Employees
  const employeeData = [
    { name: 'محمد عبدالله', jobTitle: 'مطور واجهات', email: 'mohammed@worktime.sa' },
    { name: 'سارة خالد', jobTitle: 'مصممة تجربة مستخدم', email: 'sara@worktime.sa' },
    { name: 'عمر فهد', jobTitle: 'مهندس برمجيات', email: 'omar@worktime.sa' },
    { name: 'نورة سعد', jobTitle: 'مديرة مشروع', email: 'noura@worktime.sa' },
    { name: 'عبدالرحمن علي', jobTitle: 'محلل بيانات', email: 'abdulrahman@worktime.sa' },
    { name: 'فاطمة محمد', jobTitle: 'مهندسة جودة', email: 'fatima@worktime.sa' },
    { name: 'أحمد صالح', jobTitle: 'مدير منتج', email: 'ahmed@worktime.sa' },
    { name: 'ريم عبدالعزيز', jobTitle: 'مختصة تسويق', email: 'reem@worktime.sa' },
    { name: 'سعد القحطاني', jobTitle: 'مسؤول نظم', email: 'saad@worktime.sa' },
    { name: 'هند الدوسري', jobTitle: 'باحثة مستخدمين', email: 'hind@worktime.sa' },
  ];

  const employeeProfiles = [];

  for (const emp of employeeData) {
    const user = await prisma.user.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        passwordHash,
        fullName: emp.name,
        jobTitle: emp.jobTitle,
        role: Role.EMPLOYEE,
      },
    });

    const profile = await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        isWorking: true,
        salary: 5000,
        departmentId: department.id,
        shiftId: shift.id,
        managerId: adminProfile.id,
      },
    });
    employeeProfiles.push(profile);
  }
  console.log('Mock Employees created');

  // 6. Create Attendances for the last 30 days
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i); 

    // Skip weekends (Friday = 5, Saturday = 6)
    if (date.getDay() === 5 || date.getDay() === 6) continue;

    for (const [idx, profile] of employeeProfiles.entries()) {
      // Avoid duplicate attendance for the same day
      const existing = await prisma.attendance.findUnique({
        where: {
          employeeProfileId_date: {
            employeeProfileId: profile.id,
            date: date,
          },
        },
      });

      if (!existing) {
        let status = AttendanceStatus.ON_TIME;
        let checkIn = new Date(date);
        let checkOut = new Date(date);
        let delayMinutes = 0;
        let salaryDeduction = 0;
        
        checkIn.setHours(8, Math.floor(Math.random() * 30), 0, 0); // Check-in between 8:00 and 8:30
        checkOut.setHours(16, Math.floor(Math.random() * 30), 0, 0); // Check-out between 16:00 and 16:30

        if (checkIn.getHours() === 8 && checkIn.getMinutes() > 15) {
          status = AttendanceStatus.LATE;
          delayMinutes = checkIn.getMinutes() - 15;
          salaryDeduction = Math.floor(delayMinutes * 1.5);
        }

        // Randomly make one absent
        if (idx === 1 && i === 2) {
           status = AttendanceStatus.ABSENT;
           checkIn = null;
           checkOut = null;
        }

        await prisma.attendance.create({
          data: {
            date: date,
            checkIn: checkIn,
            checkOut: checkOut,
            status: status,
            delayMinutes: delayMinutes,
            salaryDeduction: salaryDeduction,
            employeeProfileId: profile.id,
          },
        });
      }
    }
  }
  console.log('Attendances created');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
