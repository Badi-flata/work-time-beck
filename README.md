# نظام إدارة الحضور والانصراف (NestJS + Prisma + PostgreSQL)
## Attendance & Departure Management Server

مرحباً بك في التوثيق الشامل لنظام إدارة الحضور والانصراف الخلفي (**WorkTime Backend**). هذا الخادم مبني باستخدام إطار العمل **NestJS** ومحرك الاتصال **Prisma ORM** وقاعدة بيانات **PostgreSQL**، ويتبع أفضل معايير هندسة البرمجيات النظيفة (Clean Code) والبنية الطبقية المتينة.

يحقق هذا المشروع تكاملاً مطلقاً مع واجهات الجوال والويب لإدارة الموارد البشرية وتتبع إنتاجية الموظفين وساعات عملهم الفعلية بكل موثوقية وسرعة.

---

## 🔒 1. نظام الأمان وحماية الممرات (Security & Authentication)

تم تصميم الجانب الأمني في النظام بشكل صارم لحماية بيانات المنشأة الحساسة ومنع الوصول غير المصرح به:

*   **تشفير كلمات المرور (Password Hashing)**:
    يتم استخدام مكتبة `bcrypt` لتشفير كلمات المرور بشكل غير قابل للفك بمستوى Salt قوي (10 جولات) عند تسجيل الحساب، ويتم استخدام مقارنة التشفير الآمنة عند تسجيل الدخول لحماية الحسابات من هجمات الاختراق.
*   **حماية الممرات (JWT Authentication)**:
    عند تسجيل الدخول بنجاح، يُصدر الخادم رمز وصول (Bearer Access Token) موقعاً رقمياً يحتوي على معرف المستخدم الفريد (`userId`) ودوره الإداري (`role`) وله تاريخ صلاحية محدد، ويُستخدم لتأمين كافة الطلبات المستقبلية.
*   **الحراس وصلاحيات الأدوار (Role-Based Guards & Custom Decorators)**:
    *   `@Auth(Role.SUPER_ADMIN)`: يقصر مسارات لوحة التحكم والتقارير التنفيذية وإدارة الأقسام والورديات على مديري النظام فقط.
    *   `@Auth(Role.EMPLOYEE)`: يقصر مسارات تسجيل الحضور وتقديم الأعذار على الموظفين فقط.
    *   `@CurrentUser('userId')`: مستخلص مخصص ومحمي لاستخراج معرف المستخدم المسجل من الـ Token مباشرة بأمان تام من الـ Request دون تمرير المعرف بشكل مكشوف في الـ URL.
    *   `@Public()`: لتخطي الحماية في مسارات المصادقة العامة (مثل تسجيل الدخول والتسجيل الجديد).
*   **التحقق الصارم من المدخلات (Data Validation & Sanitize)**:
    تفعيل الـ `ValidationPipe` العالمي مع خيارات `whitelist` و `transform` يضمن رفض أي طلب يحتوي على حقول مشبوهة أو غير معرفة في الـ DTOs تلقائياً، مع تنظيف وتدقيق البيانات المدخلة قبل وصولها للمتحكم.
*   **سلامة وتكامل البيانات (Database Constraints)**:
    تطبيق قيود المفاتيح الأجنبية وقبلها فحوصات برمجية تمنع بشكل قاطع حذف الأقسام أو الورديات التي تحتوي على موظفين نشطين لحماية تكامل قاعدة البيانات.

---

## 📊 2. الطبقة المركزية للحسابات الإحصائية (StatisticsHelper Service)

تمثل خدمة **`StatisticsHelperService`** العقل الإحصائي المركزي للنظام. حيث تقوم بعزل جميع المعادلات الرياضية والإحصائية لبيانات الحضور لضمان اتساق تام للبيانات في الواجهات دون تكرار الكود:

*   **حساب إحصائيات لوحة التحكم (`computeDashboardStats`)**:
    تأخذ مصفوفة الموظفين لليوم الحالي وتفرزهم وتوزعهم تلقائياً إلى قوائم تفصيلية (حاضر، غائب، متأخر، معذور، هرب) مع حساب عدادات الخروج المبكر والخصومات المالية التراكمية.
*   **حساب نسبة الانضباط التراكمي (`computeDisciplineRate`)**:
    تحسب نسبة التزام الموظف بدقة بناءً على المعادلة: `(أيام الحضور في الوقت المناسب ÷ إجمالي الأيام المسجلة) × 100` وتصنف التزامه برمز عربي واضح (ممتاز >= 95% | جيد جداً >= 85% | جيد >= 70% | يحتاج تحسين < 70%).
*   **تجميع وتلخيص الحضور (`summarizeAttendances`)**:
    دالة نقية وسريعة للغاية تأخذ أي سجلات حضور لفترة زمنية محددة وتستخلص منها تلقائياً إجمالي الأيام، الغيابات، التأخيرات، دقائق الحضور والتأخر والخروج المبكر، وتعديل إجمالي الساعات الفعلية للعمل مقرباً لمنزلة عشرية واحدة.
*   **إثراء بيانات الموظفين (`enrichEmployeeData`)**:
    دمج ذكي للإحصائيات التراكمية ومعدل الانضباط مباشرة في كائن ملف الموظف لتقليل الاستعلامات المتكررة وتسهيل عرض بطاقة الموظف في دليل الموظفين.
*   **ملخص التقارير الدورية (`computePeriodSummary`)**:
    حساب الإحصائيات وساعات العمل الفعلية للتقارير الأسبوعية والشهرية وإرجاعها مدمجة بالكامل مع السجلات الخام الجاهزة للرسومات البيانية.

---

## ⚙️ 3. الدوال الرئيسية والأساسية في النظام (Core Functions)

*   **تسجيل الحضور الفوري (`checkIn`)**:
    تقوم بجلب وردية الموظف ومقارنة وقت الحضور الحالي مع وقت بدء الوردية المعتمد، وحساب دقائق التأخر تلقائياً بعد تجاوز فترة السماح بالدقائق (`gracePeriodMinIn`) وتحديد الحالة (LATE أو ON_TIME).
*   **تسجيل الانصراف الفوري (`checkOut`)**:
    تقوم بحساب دقائق العمل الفعلية بناءً على وقت الحضور الفعلي، وحساب دقائق المغادرة المبكرة (`earlyLeaveMinutes`) تلقائياً في حال انصراف العامل قبل موعد نهاية ورديته.
*   **إدارة الأعذار ومراجعتها (`submitExcuse` & `approveExcuse`)**:
    يستطيع الموظف تقديم عذر كتابي مبرر مع تحديد نوعه (تأخر في الحضور IN أو انصراف مبكر OUT). ويستطيع المدير مراجعة الأعذار المعلقة والموافقة عليها بضغطة زر، مما يؤدي لتحديث سجل الحضور تلقائياً ووضع علامة "معذور" لتسقط عنه الغرامات والخصومات المالية التراكمية.
*   **الانصراف التلقائي للورديات المفتوحة (`automaticallyCheckOut`)**:
    خوارزمية ذكية (Cron Job) تبحث عن الموظفين الذين انتهت وردياتهم وتجاوزوا فترة السماح للانصراف دون تسجيل خروج، وتقوم بإخراجهم تلقائياً مع تسجيل حالتهم كـ `ESCAPY` (هروب دون إذن) لضمان انضباط العمل.
*   **حساب الخصم المالي اليومي (`salaryDeductionDaily`)**:
    خوارزمية مالية تحسب الخصومات بدقة: دقائق التأخر دون عذر، ودقائق المغادرة دون عذر (مضروبة في سعر الدقيقة من الراتب الأساسي)، أو خصم يوم عمل كامل للمتهربين كعقوبة رادعة.

---

## 🖥️ 4. ربط مسارات الـ API مع شاشات النظام (API Endpoints & Screen Mapping)

فيما يلي خريطة الربط الكاملة والمباشرة بين مسارات الـ API في السيرفر مع الشاشات المقابلة لها في دليل تصاميم الواجهات المحدثة باللغتين العربية والإنجليزية في مجلد `workTime_screens/screens`:

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

## 🛠 5. دليل تنصيب وتشغيل المشروع (Setup & Execution Guide)

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
