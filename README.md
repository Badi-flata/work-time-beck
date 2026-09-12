<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="80" alt="NestJS Logo" />
</p>

<h1 align="center">WorkTime — Backend API</h1>

<p align="center">
  A robust, enterprise-ready <strong>Attendance & Workforce Management</strong> REST API built with <strong>NestJS</strong>, <strong>Prisma ORM</strong>, and <strong>PostgreSQL</strong>.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#database-schema">Database Schema</a> •
  <a href="#release-history">Release History</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**WorkTime Backend** is the server-side engine for a comprehensive employee attendance, departure tracking, and workforce analytics platform. It provides a clean, modular, and performant REST API powering web and mobile frontends.

The platform enables organization administrators and department managers to oversee workforce productivity, manage departments and custom shifts, process employee excuses, track granular salary deductions, run interactive demo shifts, and generate real-time periodic reports.

---

## Features

### 🔐 Authentication & Session Security
- **JWT Authentication** with dual-token architecture (Access Token + Refresh Token).
- **Session Tracking (`RefreshSession`)**: Detects token reuse, invalidates compromised refresh sessions, and tracks active device logins.
- **Role-Based Access Control (RBAC)**: Enforces permissions for `SUPER_ADMIN`, `MANAGER`, and `EMPLOYEE`.
- **bcrypt Password Hashing**: Uses 10 salt rounds for credential hashing.
- Custom decorators: `@Auth()`, `@CurrentUser()`, `@Public()` for declarative route guards.
- Global `ValidationPipe` with strict payload whitelisting.

### 🏢 Multi-Manager & Department Architecture
- **Independent Manager Scoping**: Complete operational independence between managers — each manager supervises their own departments, shifts, and subordinate employees without hierarchy collisions.
- **Super Admin Oversight**: Global administrative access for system configuration and holistic workforce auditing.
- **Department Operational Rules**: Configurable working days per month (`monthlyWorkingDays`), custom weekend days array (`weekendDays`), monthly holidays, and custom penalty amounts.

### ⏱ Attendance Management & Interactive Demo Shift
- **Check-in & Check-out**: Real-time arrival verification against shift boundaries and grace periods.
- **Interactive 10-Minute Demo Shift**: Dedicated simulation endpoints (`/attendance/demo-shift`, `demo-check-in`, `demo-check-out`) with 1-min preparation, 7-min work, and grace periods for testing attendance flows.
- **Auto Check-out Engine**: Scheduled cron job that automatically closes overdue shifts and marks unauthorized departures as `ESCAPY`.

### 💰 Granular Salary Deductions Engine
- **Per-Status Penalty Calculation**: Separate tracking for late arrivals, unauthorized early departures, and unexcused absences.
- **JSON Deduction Breakdown (`deductionBreakdown`)**: Persists itemized deductions (`late`, `earlyLeave`, `absent`) and deduction counts per attendance record.
- **Customizable Deduction Combinations**: Managers can configure whether to combine all daily deductions or apply prioritized penalties.
- **Excuse Reimbursement**: Approving an excuse selectively refunds the specific penalty portion and resets corresponding delay/absence minutes.

### 📝 Excuse Workflow & Audit Trail
- Employees submit typed excuses (`ABSENT`, `LATE`, `EARLY_DEPARTURE`).
- Managers review, approve, or reject pending excuses with explanatory administrative notes (`adminNotes`).
- Real-time synchronization between excuse status and attendance records.

### 🖼️ Profile & Media Storage
- **`LocalFileStorageService`**: Dedicated storage service handling file uploads, filename sanitization, and local disk persistence.
- Static asset serving via `/uploads/avatars/...` with Express static file integration.
- Avatar upload and profile picture management endpoints (`/users/upload-avatar`, `/users/update-avatar`).

### 📊 Real-Time Dashboard & Analytics Engine
- **Unified Dashboard Registry**: Flexible multi-mode registry supporting `daily`, `weekly`, `monthly`, and paginated `ALL` modes.
- **Centralized Computation Layer (`StatisticsHelperService`)**: Calculates discipline rates with performance tiers (Excellent ≥ 95%, Good ≥ 85%, Fair ≥ 70%), period summaries, and employee performance metrics.

---

## Tech Stack

| Layer            | Technology                                                  |
| :--------------- | :---------------------------------------------------------- |
| **Runtime**      | [Node.js](https://nodejs.org/) (v18+)                       |
| **Framework**    | [NestJS](https://nestjs.com/) v11                           |
| **ORM**          | [Prisma](https://www.prisma.io/) v6                         |
| **Database**     | [PostgreSQL](https://www.postgresql.org/)                   |
| **Auth**         | [JWT](https://jwt.io/) via `@nestjs/jwt` + [bcrypt](https://www.npmjs.com/package/bcrypt) |
| **Validation**   | `class-validator` + `class-transformer`                     |
| **Date Handling**| `date-fns` + `date-fns-tz`                                 |
| **API Docs**     | [Swagger](https://swagger.io/) via `@nestjs/swagger`        |
| **Storage**      | Local static file storage (`/uploads`)                      |
| **Testing**      | [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest) |

---

## Architecture

```
src/
├── core/                                # Cross-cutting foundation
│   ├── auth/                            #   JWT auth, refresh sessions, token reuse detection
│   ├── decorators/                      #   @Auth(), @CurrentUser(), @Public()
│   ├── filters/                         #   AllExceptionsFilter with standardized JSON errors
│   ├── guards/                          #   JWT and RBAC role-based guards
│   └── storage/                         #   LocalFileStorageService & storage interfaces
│
├── users/                               # User accounts, registration, login, avatars
├── employee/                            # Employee profile, personal dashboards & reports
├── managing/                            # Manager dashboard registry, excuses, team management
├── attendance/                          # Clock in/out, demo shift simulation, excuse submission
├── department/                          # Department & shift management with operational rules
│
├── utilities/                           # Central computational services
│   ├── statistics-helper.service.ts     #   Centralized statistics & discipline calculations
│   ├── caculaePeriod.service.ts         #   Time-bound period boundaries (weeks, months)
│   └── utilities.service.ts             #   Deduction engine, auto check-out & calculations
│
├── prisma/                              # Prisma database client service
├── seed-data.ts                         # Standalone seed script
├── app.module.ts                        # Root module configuration
└── main.ts                              # Application bootstrap with CORS, Swagger & static assets
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **PostgreSQL** (v14+) running locally or remotely
- **npm** package manager

### 1. Clone & Install

```bash
git clone https://github.com/Badi-flata/workTime-backend.git
cd workTime-backend
npm install
```

### 2. Configure Environment Variables

Copy the example configuration file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/workecTime?schema=public"
NODE_ENV="development"
PORT=3030
JWT_SECRET="your-secure-jwt-secret-key"
CORS_ORIGIN="http://localhost:3000"
```

### 3. Run Database Migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Seed Database (Comprehensive 3-Month Dataset)

```bash
node seed-dev.js
```

Generates 3 independent managers (1 Super Admin + 2 Managers), 30 employees, profile avatars, and 3 months of progressive attendance records.

### 5. Start Application

```bash
# Development with hot-reload
npm run start:dev

# Production build
npm run build
npm run start:prod
```

API server will be listening at `http://localhost:3030`.  
Swagger documentation available at `http://localhost:3030/api/docs`.

---

## API Reference

### 🔓 Public Routes

| Method | Endpoint         | Description                              |
| :----- | :--------------- | :--------------------------------------- |
| `POST` | `/users/logUp`   | Register a new account                   |
| `POST` | `/users/loginIn` | Sign in & receive access + refresh token |
| `POST` | `/users/refresh` | Refresh access token via refresh token   |

---

### 👤 Authenticated User Routes

| Method   | Endpoint                  | Description                               |
| :------- | :------------------------ | :---------------------------------------- |
| `GET`    | `/users/myProfile`        | Get currently authenticated user profile  |
| `PATCH`  | `/users/updateMyProfile`  | Update own name, phone, or job title      |
| `POST`   | `/users/upload-avatar`    | Upload profile picture (multipart/form)   |
| `PATCH`  | `/users/update-avatar`    | Update avatar URL directly                |
| `POST`   | `/users/logout`           | Revoke current refresh session & log out  |
| `GET`    | `/users/search_Word`      | Search workforce directory                |
| `DELETE` | `/users/deleteMyProfile`  | Delete own user account                   |

---

### 👷 Employee Routes — `Role: EMPLOYEE`

| Method | Endpoint                       | Description                                      |
| :----- | :----------------------------- | :----------------------------------------------- |
| `GET`  | `/employee/profile`            | Get employee profile, shift & department details |
| `PATCH`| `/employee/update-profile`     | Update personal employee record details          |
| `GET`  | `/employee/today-status`       | Get today's attendance status & active shift     |
| `GET`  | `/employee/weekly-report`      | Get personal weekly attendance report            |
| `GET`  | `/employee/monthly-report`     | Get personal monthly attendance report           |
| `GET`  | `/employee/my-dashboard`       | Get personal dashboard metrics & discipline rate |
| `GET`  | `/employee/discipline-rate`    | Calculate employee discipline percentage         |
| `POST` | `/attendance/check-in`         | Clock in for active scheduled shift              |
| `POST` | `/attendance/check-out`        | Clock out from active scheduled shift            |
| `POST` | `/attendance/submit-excuse`    | Submit excuse (`ABSENT`, `LATE`, `EARLY_LEAVE`)  |
| `GET`  | `/attendance/demo-shift`       | Get or generate isolated 10-minute demo shift    |
| `POST` | `/attendance/demo-check-in`    | Clock in for interactive demo simulation         |
| `POST` | `/attendance/demo-check-out`   | Clock out from interactive demo simulation       |

---

### 👑 Manager & Admin Routes — `Role: SUPER_ADMIN | MANAGER`

| Method   | Endpoint                                        | Description                                     |
| :------- | :---------------------------------------------- | :---------------------------------------------- |
| `GET`    | `/managing/dashboard-registry`                  | Unified registry (`daily`, `weekly`, `monthly`) |
| `GET`    | `/managing/my-employees`                        | List all subordinates managed by this manager   |
| `POST`   | `/managing/add-employee/:id`                   | Assign an employee to manager's team            |
| `DELETE` | `/managing/delete-employee/:id`                | Remove an employee from manager's team          |
| `POST`   | `/managing/turn-department-employee`            | Transfer employee to another department & shift |
| `GET`    | `/managing/pending-excuses`                    | List pending excuses for manager's subordinates |
| `POST`   | `/managing/approve-excuse/:id`                 | Approve excuse & selectively refund deductions  |
| `POST`   | `/managing/reject-excuse/:id`                  | Reject excuse with manager feedback note        |
| `POST`   | `/managing/auto-checkout`                      | Trigger immediate auto check-out for overdue    |
| `POST`   | `/managing/salary-deduction/:employeeId`       | Recalculate daily salary deduction for employee |
| `GET`    | `/managing/settings`                           | Get manager automation & deduction preferences  |
| `PATCH`  | `/managing/settings`                           | Update auto check-out and deduction rules       |

---

### 🏢 Department & Shift Routes — `Role: SUPER_ADMIN | MANAGER`

| Method   | Endpoint                      | Description                                          |
| :------- | :---------------------------- | :--------------------------------------------------- |
| `GET`    | `/department`                 | List all departments managed by authenticated manager|
| `GET`    | `/department/:id`             | Get department details by ID                         |
| `POST`   | `/department`                 | Create department with operational rules & penalties |
| `PATCH`  | `/department/:id`             | Update department rules, working days, and penalties |
| `DELETE` | `/department/:id`             | Delete department (protected against active members) |
| `GET`    | `/department/list/names`      | Dropdown options of department names                 |
| `GET`    | `/department/manager/shifts`  | Get all shifts belonging to manager's departments    |

---

## Database Schema

```mermaid
erDiagram
    User ||--o| AdminProfile : "extends"
    User ||--o| EmployeeProfile : "extends"
    User ||--o{ RefreshSession : "owns"
    AdminProfile ||--o{ Department : "manages"
    AdminProfile ||--o{ EmployeeProfile : "supervises"
    Department ||--o{ EmployeeProfile : "contains"
    Department ||--o{ Shift : "has"
    Shift ||--o{ EmployeeProfile : "assigned"
    EmployeeProfile ||--o{ Attendance : "records"
    Attendance ||--o{ Excuse : "has"

    User {
        uuid id PK
        string email UK
        string passwordHash
        string fullName
        string jobTitle
        string imageProfile
        enum role
        string phone
    }

    AdminProfile {
        uuid id PK
        uuid userId FK
        boolean autoCheckoutEnabled
        boolean isActiveDeduction
        boolean combineDeductionsOnEndShift
        boolean delayDeductionEnabled
        boolean earlyLeaveDeductionEnabled
        boolean absentDeductionEnabled
    }

    Department {
        uuid id PK
        string name UK
        string description
        int monthlyWorkingDays
        int[] weekendDays
        int monthlyHolidays
        float latePenaltyAmount
        float earlyLeavePenaltyAmount
        float absentPenaltyAmount
        uuid managerId FK
    }

    Shift {
        uuid id PK
        string name
        string startTime
        string endTime
        int gracePeriodMinIn
        int gracePeriodMinOut
        uuid departmentsId FK
    }

    Attendance {
        uuid id PK
        date date
        datetime checkIn
        datetime checkOut
        enum status
        int delayMinutes
        int earlyLeaveMinutes
        int lateMinutes
        float totalWorkedHours
        int salaryDeduction
        int deductionsCount
        json deductionBreakdown
        string adminNotes
        string employeeNote
        uuid employeeProfileId FK
    }

    Excuse {
        uuid id PK
        string reason
        enum type
        boolean isApproved
        uuid attendanceId FK
        uuid submittedById
    }

    RefreshSession {
        uuid id PK
        string tokenHash UK
        uuid userId FK
        boolean isRevoked
        datetime expiresAt
    }
```

---

## Release History

### 🚀 v4.0.0 — Enterprise Attendance & Multi-Manager Operations
- **Multi-Manager Independence**: Independent scoping for `MANAGER` roles supervising separate departments and teams.
- **Department Operational Rules**: Added configurable monthly working days, custom weekends, and status penalties.
- **Granular Deductions Breakdown**: Itemized JSON breakdown for late, early leave, and absent penalties with automatic excuse reimbursement.
- **Interactive Demo Shift Simulation**: Isolated 10-minute dynamic shift endpoints for live check-in/out testing.
- **Media Storage & Avatars**: Local storage service for avatar uploads and static file serving via `/uploads/avatars`.
- **Refresh Session Tracking**: Multi-device login tracking, token reuse detection, and session invalidation.
- **E2E Test Suites**: Automated tests for auto check-out and consistency audit.

### 📦 v3.5.0 — Modular Architecture & API Standardization
- **Modular Refactoring**: Separated logic into `department`, `employee`, `attendance`, `managing`, `users`, and `core`.
- **OpenAPI / Swagger**: Comprehensive Swagger documentation and interactive testing interface.
- **Period Calculation Engine**: Isolated `calculate-period.service.ts` for standardized week and month slicing.
- **Cross-Day Shifts**: Full support for overnight and cross-day shift boundary tracking.
- **Global Error Handling**: Standardized `AllExceptionsFilter` with structured API responses.

### 📦 v3.0.0 — Unified Dashboard Registry
- Replaced legacy individual report endpoints with unified, multi-mode dashboard registry (`daily`, `weekly`, `monthly`, `all`).

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<p align="center">
  Built with ❤️ using <a href="https://nestjs.com/">NestJS</a>
</p>
