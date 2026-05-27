# نظام إدارة الحضور والانصراف (NestJS + Prisma + PostgreSQL)
## Attendance & Departure Management Server

مرحباً بك في المستودع البرمجي المحدث لنظام إدارة الحضور والانصراف الخلفي (WorkTime Backend)، المبني باستخدام إطار العمل **NestJS** ومحرك الاتصال **Prisma ORM** وقاعدة بيانات **PostgreSQL**.

تم تصميم وتطوير هذا الخادم بأسلوب برمجي متطور وبنية هندسية متينة متوافقة بالكامل مع متطلبات واجهات الويب والجوال المتخصصة في تتبع ساعات العمل، مع توفير واجهات برمجية متكاملة لكل من **المدير (SUPER_ADMIN)** و **الموظف/العامل (EMPLOYEE)**.

---

## 🏗️ التحديثات الجديدة وسد الثغرات (New Updates & Gap-Closing)

تم إجراء تحديثات برمجية وهيكلية شاملة لسد كافة الفجوات وضمان التوافق المطلق مع شاشات النظام:
1. **الطبقة الحسابية المركزية (`StatisticsHelper`)**: عزل كامل للعمليات الإحصائية والحسابية لضمان عدم تكرار الكود وسهولة الصيانة.
2. **تفعيل أمن الاتصال والتحقق**: تفعيل الـ CORS لحل مشكلة الاتصال مع الواجهات الأمامية، وتفعيل الـ `ValidationPipe` العالمي لضمان فلترة وتدقيق صحة المدخلات.
3. **موديول الأقسام CRUD كامل (`Department Module`)**: إضافة إمكانية العرض، التفاصيل، الإنشاء، التعديل، والحذف الآمن للأقسام.
4. **موديول الورديات CRUD كامل (`Shift CRUD`)**: إضافة إمكانية تعديل وحذف وعرض الورديات التابعة لأقسام المدير بشكل آمن.
5. **نظام الأعذار وملاحظات الموظفين**: إتاحة كتابة الملاحظات للموظف عند الانصراف، وتقديم الأعذار (تأخر/خروج مبكر)، مع إمكانية مراجعة وقبول الأعذار من طرف المدير.
6. **التقرير اليومي التنفيذي**: توفير إحصائيات متقدمة مثل مؤشر انضباط الفريق، والترتيب التراكمي للموظفين الأكثر انضباطاً، ورسومات بيانية جاهزة بالنسب المئوية.
7. **مرشح استثناءات ذكي ومُعرّب**: تعديل معالج الأخطاء ليرد برسائل عربية مخصصة لكل جدول في قاعدة البيانات في حالات التعارض، مع حماية أمن البيانات الفنية.

---

## 📊 الطبقة المركزية للحسابات الإحصائية (Centralized Computation Layer)

تم بناء **`StatisticsHelperService`** كطبقة برمجية جامعة ومركزية لتوحيد جميع الحسابات الرياضية والإحصائية في النظام وتجنب تكرار الكود في الـ Endpoints المختلفة. تحتوي هذه الخدمة على 5 دوال أساسية:

### 1. `summarizeAttendances(attendances: any[]): AttendanceSummary`
* **نوع الدالة:** دالة نقية (Pure Function) — لا تجري أي استعلامات في قاعدة البيانات.
* **المدخلات:** مصفوفة سجلات حضور خام (من قاعدة البيانات) لأي فترة زمنية (يوم، أسبوع، شهر، أو فترة مخصصة).
* **المخرجات:** ملخص إحصائي كامل وموحد يحتوي على:
  * `totalDays`: إجمالي الأيام المسجلة.
  * `presentDays`: عدد أيام الحضور الفعلي (في الوقت المناسب + التأخير).
  * `onTimeDays` & `lateDays`: تفصيل الحاضرين في الوقت والمحرومين من فترة السماح.
  * `absentDays` & `excusedDays` & `escapedDays`: تعداد الغائبين والمعذورين والموظفين الذين انصرفوا دون تسجيل خروج.
  * `earlyDepartureCount`: عدد مرات الخروج المبكر قبل نهاية الوردية.
  * `totalWorkedMinutes` & `totalWorkedHours`: إجمالي دقائق وساعات العمل الفعلي بدقة (مقرباً لمنزلة عشرية واحدة).
  * `totalDelayMinutes` & `totalEarlyLeaveMinutes`: إجمالي دقائق التأخير والخروج المبكر التراكمية.

### 2. `computeDisciplineRate(employeeProfileId: string, days?: number): Promise<DisciplineRate>`
* **الوصف:** تحسب معدل التزام وانضباط الموظف كنسبة مئوية خلال آخر N يوم (الافتراضي 30 يوماً).
* **المعادلة:** `(أيام الحضور في الوقت المناسب ÷ إجمالي الأيام المسجلة) × 100`.
* **التقييم التلقائي:**
  * **ممتاز (Excellent):** إذا كانت النسبة >= 95%.
  * **جيد جداً (Very Good):** إذا كانت النسبة بين 85% و 94%.
  * **جيد (Good):** إذا كانت النسبة بين 70% و 84%.
  * **يحتاج تحسين (Needs Improvement):** إذا كانت النسبة أقل من 70%.

### 3. `computeDashboardStats(subordinates: any[]): DashboardStats`
* **الوصف:** تقوم بتصنيف الموظفين لليوم الحالي لحساب لوحة تحكم المدير، وتوزيعهم في قوائم تفصيلية بناءً على حالتهم الحالية (حاضر، غائب، متأخر، معذور، هرب)، مع حساب عدادات الخروج المبكر، وتعداد من طُبقت عليهم خصومات مالية، والموظفين الذين انصرفوا أو الذين لم يسجلوا خروجاً بعد.

### 4. `enrichEmployeeData(employeeProfile: any, options?: any): Promise<EnrichedEmployee>`
* **الوصف:** تثري الملف التعريفي والمهني للموظف بإدراج إحصائيات انضباطه التراكمية وملخص حضور آخر 30 يوماً تلقائياً في الطلب لتقليل عدد الاستعلامات من الواجهة الأمامية.

### 5. `computePeriodSummary(attendances: any[]): PeriodSummary`
* **الوصف:** تأخذ سجلات الحضور لفترة دورية محددة (أسبوع أو شهر مثلاً)، وتحسب ملخص الفترة بدقة وتعيد الملفات الخام مع الملخص جاهزاً للرسم البياني أو العرض المباشر.

---

## 🖥️ ربط مسارات الـ API مع شاشات النظام (API Endpoints & Screen Mapping)

تمت إعادة هيكلة وتسمية شاشات النظام في مجلد **`workTime_screens/screens`** باللغتين العربية والإنجليزية لتكون معبرة بالكامل عن محتواها الفعلي. أدناه جدول ربط كامل بين كل Endpoint والشاشة التي تعتمد عليه:

### 🔓 الممرات العامة (Public Route APIs)

| المسار (API Route) | طريقة الطلب (Method) | اسم الشاشة بالعربي | Screen Name in English | مجلد الشاشة |
| :--- | :--- | :--- | :--- | :--- |
| `/users/logUp` | `POST` | شاشة تسجيل حساب مدير / شاشة تسجيل حساب موظف | Manager Sign Up / Employee Sign Up | `Manager_Sign_Up_تسجيل_حساب_مدير`<br>`Employee_Sign_Up_تسجيل_حساب_موظف` |
| `/users/loginIn` | `POST` | شاشة تسجيل الدخول | Login Screen | `Login_Screen_شاشة_تسجيل_الدخول` |

---

### 👥 ممرات المستخدم (Authenticated User APIs)

| المسار (API Route) | طريقة الطلب (Method) | اسم الشاشة بالعربي | Screen Name in English | مجلد الشاشة |
| :--- | :--- | :--- | :--- | :--- |
| `/users/search_Word` | `GET` | دليل الموظفين / شاشة البحث | Employees Directory / Search Screen | `Employees_Directory_دليل_الموظفين` |
| `/users/updateMyProfile` | `PATCH` | شاشة الملف الشخصي للموظف | Employee Profile Screen | `Employee_Profile_الملف_الشخصي_للموظف` |
| `/users/deleteMyProfile` | `DELETE` | شاشة الملف الشخصي للموظف | Employee Profile Screen | `Employee_Profile_الملف_الشخصي_للموظف` |

---

### 👷 ممرات الموظف (Employee Exclusive APIs) - `@Auth(Role.EMPLOYEE)`

| المسار (API Route) | طريقة الطلب (Method) | اسم الشاشة بالعربي | Screen Name in English | مجلد الشاشة |
| :--- | :--- | :--- | :--- | :--- |
| `/employee/profile` | `GET` | شاشة الملف الشخصي للموظف | Employee Profile Screen | `Employee_Profile_الملف_الشخصي_للموظف` |
| `/employee/set-manager` | `POST` | بطاقة معلومات الموظف / نافذة إضافة موظف | Employee Info Card / Add Employee Window | `Employee_Info_Card_بطاقة_معلومات_الموظف` |
| `/employee/update-profile` | `PATCH` | شاشة الملف الشخصي للموظف | Employee Profile Screen | `Employee_Profile_الملف_الشخصي_للموظف` |
| `/employee/today-status` | `GET` | شاشة تسجيل الحضور والانصراف للموظف | Clock-in and Clock-out Screen | `Clock_In_Out_Screen_تسجيل_الحضور_والانصراف` |
| `/employee/weekly-report` | `GET` | لوحة تحكم الموظف الشخصية | Employee Personal Dashboard | `Employee_Personal_Dashboard_لوحة_تحكم_الموظف_الشخصية` |
| `/employee/monthly-report` | `GET` | لوحة تحكم الموظف الشخصية | Employee Personal Dashboard | `Employee_Personal_Dashboard_لوحة_تحكم_الموظف_الشخصية` |
| `/employee/my-dashboard` | `GET` | لوحة تحكم الموظف الشخصية | Employee Personal Dashboard | `Employee_Personal_Dashboard_لوحة_تحكم_الموظف_الشخصية` |
| `/employee/discipline-rate` | `GET` | لوحة تحكم الموظف الشخصية | Employee Personal Dashboard | `Employee_Personal_Dashboard_لوحة_تحكم_الموظف_الشخصية` |
| `/attendance/check-in` | `POST` | شاشة تسجيل الحضور والانصراف للموظف | Clock-in and Clock-out Screen | `Clock_In_Out_Screen_تسجيل_الحضور_والانصراف` |
| `/attendance/check-out` | `POST` | شاشة تسجيل الحضور والانصراف للموظف | Clock-in and Clock-out Screen | `Clock_In_Out_Screen_تسجيل_الحضور_والانصراف` |
| `/attendance/submit-excuse` | `POST` | شاشة تسجيل الحضور والانصراف للموظف | Clock-in and Clock-out Screen | `Clock_In_Out_Screen_تسجيل_الحضور_والانصراف` |

---

### 👑 ممرات المدير (Manager Exclusive APIs) - `@Auth(Role.SUPER_ADMIN)`

| المسار (API Route) | طريقة الطلب (Method) | اسم الشاشة بالعربي | Screen Name in English | مجلد الشاشة |
| :--- | :--- | :--- | :--- | :--- |
| `/managing/dashboard` | `GET` | لوحة تحكم الحضور الرئيسية للمدير / شاشة نبض الحضور الحي | Manager Dashboard / Live Attendance Pulse | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير`<br>`Live_Attendance_Pulse_نبض_الحضور_الحي` |
| `/managing/daily-report` | `GET` | التقرير اليومي التنفيذي | Executive Daily Report | `Executive_Daily_Report_التقرير_اليومي_التنفيذي` |
| `/managing/add-employee/:id` | `POST` | دليل الموظفين / شاشة البحث | Employees Directory / Search Screen | `Employees_Directory_دليل_الموظفين` |
| `/managing/delete-employee/:id` | `DELETE` | دليل الموظفين / شاشة البحث | Employees Directory / Search Screen | `Employees_Directory_دليل_الموظفين` |
| `/managing/my-employees` | `GET` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير`<br>`Manager_Dashboard_Table_جدول_الحضور_للمدير` |
| `/managing/make-a-shift` | `POST` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/managing/shifts` | `GET` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/managing/shifts/:id` | `PATCH` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/managing/shifts/:id` | `DELETE` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/managing/audit-employee` | `PATCH` | بطاقة معلومات الموظف / نافذة إضافة موظف | Employee Info Card / Add Employee Window | `Employee_Info_Card_بطاقة_معلومات_الموظف` |
| `/managing/weekly-report` | `GET` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |
| `/managing/monthly-report` | `GET` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |
| `/managing/employee-weekly-report/:id` | `GET` | سجل حضور الموظف التفصيلي | Detailed Attendance Log Screen | `Detailed_Attendance_Log_سجل_الحضور_التفصيلي` |
| `/managing/employee-monthly-report/:id`| `GET` | سجل حضور الموظف التفصيلي | Detailed Attendance Log Screen | `Detailed_Attendance_Log_سجل_الحضور_التفصيلي` |
| `/managing/discipline-rate/:employeeProfileId`| `GET` | بطاقة معلومات الموظف / نافذة إضافة موظف | Employee Info Card / Add Employee Window | `Employee_Info_Card_بطاقة_معلومات_الموظف` |
| `/managing/pending-excuses` | `GET` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |
| `/managing/approve-excuse/:id` | `POST` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |
| `/managing/auto-checkout` | `POST` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |
| `/managing/salary-deduction/:employeeId`| `POST` | لوحة تحكم الحضور الرئيسية للمدير | Manager Dashboard | `Manager_Dashboard_Main_لوحة_التحكم_الرئيسية_للمدير` |

---

### 🏢 ممرات الأقسام (Department APIs) - `@Auth(Role.SUPER_ADMIN)`

| المسار (API Route) | طريقة الطلب (Method) | اسم الشاشة بالعربي | Screen Name in English | مجلد الشاشة |
| :--- | :--- | :--- | :--- | :--- |
| `/department` | `GET` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/department/:id` | `GET` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/department` | `POST` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/department/:id` | `PATCH` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/department/:id` | `DELETE` | شاشة إدارة الأقسام والورديات | Departments and Shifts Management Screen | `Departments_Shifts_Management_إدارة_الأقسام_والورديات` |
| `/department/list/names` | `GET` | بطاقة معلومات الموظف / شاشة تسجيل حساب موظف | Employee Info Card / Employee Sign Up | `Employee_Info_Card_بطاقة_معلومات_الموظف`<br>`Employee_Sign_Up_تسجيل_حساب_موظف` |

---

## 🛠 دليل تنصيب وتشغيل المشروع (Setup & Execution Guide)

### المتطلبات المسبقة:
- تثبيت **Node.js** (إصدار 18 فما فوق).
- وجود قاعدة بيانات **PostgreSQL** نشطة.

### خطوات التشغيل الفورية:

1. **تثبيت الحزم البرمجية:**
   ```bash
   npm install
   ```

2. **تجهيز ملف البيئة (.env):**
   قم بإنشاء ملف `.env` في جذر المشروع وضع بداخله رابط قاعدة البيانات ومفتاح تشفير JWT والمنفذ:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/workecTime?schema=public"
   JWT_SECRET="YOUR_SUPER_SECRET_KEY_HERE"
   PORT=3030
   CORS_ORIGIN="http://localhost:3000"
   ```

3. **تشغيل ترحيل قاعدة البيانات وتوليد Prisma Client:**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

4. **تهيئة قاعدة البيانات بالبيانات التجريبية (Seeding):**
   ```bash
   npx ts-node -r tsconfig-paths/register src/seed-data.ts
   ```

5. **تشغيل الخادم في بيئة التطوير المباشرة:**
   ```bash
   npm run start:dev
   ```

6. **بناء المشروع لبيئة الإنتاج والتحقق:**
   ```bash
   npm run build
   ```

---

## 📄 رخصة الاستخدام (License)
المشروع متاح تحت رخصة **MIT License** الحرة ومفتوحة المصدر.
