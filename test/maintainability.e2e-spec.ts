import { ResponseHelper } from '../src/core/helpers/response.helper';
import {
  AlreadyCheckedInException,
  AlreadyCheckedOutException,
  CheckInExpiredException,
  CheckOutBeforeCheckInException,
  CheckOutExpiredException,
} from '../src/core/domain-exceptions/attendance.exceptions';
import {
  DepartmentNotFoundException,
  DepartmentHasEmployeesException,
  DuplicateDepartmentException,
  ManagerProfileNotFoundException,
} from '../src/core/domain-exceptions/department.exceptions';
import {
  ShiftNotFoundException,
  ShiftHasEmployeesException,
  ShiftDepartmentNotFoundException,
} from '../src/core/domain-exceptions/shift.exceptions';
import {
  EmployeeNotFoundException,
  EmployeeAlreadyAssignedException,
  CannotAssignManagerAsEmployeeException,
  EmployeeProfileNotFoundException,
} from '../src/core/domain-exceptions/employee.exceptions';
import {
  InvalidCredentialsException,
  EmailAlreadyExistsException,
  SessionExpiredException,
  InsufficientPermissionsException,
} from '../src/core/domain-exceptions/auth.exceptions';
import { CalculatePeriodService } from '../src/utilities/calculate-period.service';
import { Modes } from '../src/utilities/types/dashboard-registry.types';

describe('Backend Maintainability & Domain Exceptions Unit Tests', () => {
  describe('1. ResponseHelper Standardization', () => {
    it('should format a successful response with statusCode 200, message, data, and ISO timestamp', () => {
      const payload = { id: '123', name: 'IT Department' };
      const response = ResponseHelper.success(payload, 'تم جلب القسم بنجاح');

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('تم جلب القسم بنجاح');
      expect(response.data).toEqual(payload);
      expect(typeof response.timestamp).toBe('string');
      expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
    });

    it('should format a created response with statusCode 201', () => {
      const payload = { id: 'shift-1', name: 'صباحي' };
      const response = ResponseHelper.created(payload, 'تمت إضافة الوردية بنجاح');

      expect(response.statusCode).toBe(201);
      expect(response.message).toBe('تمت إضافة الوردية بنجاح');
      expect(response.data).toEqual(payload);
    });

    it('should format a paginated response with meta pagination details', () => {
      const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const response = ResponseHelper.paginated(items, 10, 1, 3, 'قائمة الموظفين');

      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveLength(3);
      expect(response.meta).toBeDefined();
      expect(response.meta?.page).toBe(1);
      expect(response.meta?.limit).toBe(3);
      expect(response.meta?.totalItems).toBe(10);
      expect(response.meta?.totalPages).toBe(4);
    });
  });

  describe('2. Domain Exceptions — Attendance', () => {
    it('AlreadyCheckedInException should have status 409 and ATTENDANCE_DUPLICATE_CHECKIN', () => {
      const ex = new AlreadyCheckedInException();
      expect(ex.getStatus()).toBe(409);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_DUPLICATE_CHECKIN');
      expect(res.message).toBe('تم تسجيل الحضور بالفعل');
    });

    it('AlreadyCheckedOutException should have status 409 and ATTENDANCE_DUPLICATE_CHECKOUT', () => {
      const ex = new AlreadyCheckedOutException();
      expect(ex.getStatus()).toBe(409);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_DUPLICATE_CHECKOUT');
      expect(res.message).toBe('تم تسجيل الإنصراف بالفعل');
    });

    it('CheckOutBeforeCheckInException should have status 403 and ATTENDANCE_NO_CHECKIN', () => {
      const ex = new CheckOutBeforeCheckInException();
      expect(ex.getStatus()).toBe(403);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_NO_CHECKIN');
      expect(res.message).toBe('لا يمكن تسجيل الانصراف قبل تسجيل الحضور');
    });

    it('CheckInExpiredException should have status 403 and ATTENDANCE_EXPIRED_CHECKIN', () => {
      const ex = new CheckInExpiredException();
      expect(ex.getStatus()).toBe(403);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_EXPIRED_CHECKIN');
    });

    it('CheckOutExpiredException should have status 403 and ATTENDANCE_EXPIRED_CHECKOUT', () => {
      const ex = new CheckOutExpiredException();
      expect(ex.getStatus()).toBe(403);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_EXPIRED_CHECKOUT');
    });
  });

  describe('3. Domain Exceptions — Departments & Shifts', () => {
    it('DepartmentNotFoundException should have status 404 and DEPARTMENT_NOT_FOUND', () => {
      const ex = new DepartmentNotFoundException();
      expect(ex.getStatus()).toBe(404);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('DepartmentHasEmployeesException should contain employee count in message', () => {
      const ex = new DepartmentHasEmployeesException(5);
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('DEPARTMENT_HAS_EMPLOYEES');
      expect(res.message).toContain('5');
    });

    it('ShiftNotFoundException should have status 404 and SHIFT_NOT_FOUND', () => {
      const ex = new ShiftNotFoundException();
      expect(ex.getStatus()).toBe(404);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('SHIFT_NOT_FOUND');
    });

    it('ShiftHasEmployeesException should have status 400 and SHIFT_HAS_EMPLOYEES', () => {
      const ex = new ShiftHasEmployeesException(3);
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('SHIFT_HAS_EMPLOYEES');
      expect(res.message).toContain('3');
    });

    it('ShiftDepartmentNotFoundException should have status 404 and SHIFT_DEPARTMENT_NOT_FOUND', () => {
      const ex = new ShiftDepartmentNotFoundException();
      expect(ex.getStatus()).toBe(404);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('SHIFT_DEPARTMENT_NOT_FOUND');
    });
  });

  describe('4. Domain Exceptions — Employee & Auth', () => {
    it('EmployeeAlreadyAssignedException should have status 400 and EMPLOYEE_ALREADY_ASSIGNED', () => {
      const ex = new EmployeeAlreadyAssignedException();
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('EMPLOYEE_ALREADY_ASSIGNED');
    });

    it('CannotAssignManagerAsEmployeeException should have status 400 and INVALID_ROLE_ASSIGNMENT', () => {
      const ex = new CannotAssignManagerAsEmployeeException();
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('INVALID_ROLE_ASSIGNMENT');
    });

    it('InvalidCredentialsException should have status 401 and INVALID_CREDENTIALS', () => {
      const ex = new InvalidCredentialsException();
      expect(ex.getStatus()).toBe(401);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('INVALID_CREDENTIALS');
    });

    it('InsufficientPermissionsException should have status 401 and INSUFFICIENT_PERMISSIONS', () => {
      const ex = new InsufficientPermissionsException();
      expect(ex.getStatus()).toBe(401);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('5. CalculatePeriodService — Mode Calculation', () => {
    const periodService = new CalculatePeriodService();

    it('should calculate DAILY period correctly', () => {
      const result = periodService.calculateMonthlyBoundedPeriod(Modes.DAILY, '2026-06-15');
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
      expect(result.periodLabel).toContain('15 يونيو 2026');
    });

    it('should calculate WEEKLY period with Arabic week label', () => {
      const result = periodService.calculateMonthlyBoundedPeriod(Modes.WEEKLY, '2026-06-10');
      expect(result.periodLabel).toContain('الأسبوع الثاني');
    });

    it('should calculate MONTHLY period with full month boundary', () => {
      const result = periodService.calculateMonthlyBoundedPeriod(Modes.MONTHLY, '2026-06-01');
      expect(result.periodLabel).toContain('شهر يونيو 2026');
    });

    it('should calculate ALL mode covering last 3 months by default', () => {
      const result = periodService.calculateMonthlyBoundedPeriod(Modes.ALL, '2026-06-15');
      expect(result.periodLabel).toContain('فترة مخصصة');
      expect(result.startDate.getUTCMonth()).toBe(2); // March (June - 3)
    });
  });

  describe('6. Domain Exceptions — Managing & Utility', () => {
    it('ExcuseNotFoundException should have status 404 and EXCUSE_NOT_FOUND', () => {
      const { ExcuseNotFoundException } = require('../src/core/domain-exceptions/managing.exceptions');
      const ex = new ExcuseNotFoundException();
      expect(ex.getStatus()).toBe(404);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('EXCUSE_NOT_FOUND');
    });

    it('EmployeeNotUnderManagerException should have status 403 and EMPLOYEE_NOT_UNDER_MANAGER', () => {
      const { EmployeeNotUnderManagerException } = require('../src/core/domain-exceptions/managing.exceptions');
      const ex = new EmployeeNotUnderManagerException();
      expect(ex.getStatus()).toBe(403);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('EMPLOYEE_NOT_UNDER_MANAGER');
    });

    it('AttendanceRecordsNotFoundException should have status 404 and ATTENDANCE_RECORDS_NOT_FOUND', () => {
      const { AttendanceRecordsNotFoundException } = require('../src/core/domain-exceptions/utility.exceptions');
      const ex = new AttendanceRecordsNotFoundException('2026-06-01', 'MONTHLY');
      expect(ex.getStatus()).toBe(404);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('ATTENDANCE_RECORDS_NOT_FOUND');
      expect(res.message).toContain('2026-06-01');
    });

    it('InvalidPeriodDateException should have status 400 and INVALID_PERIOD_DATE', () => {
      const { InvalidPeriodDateException } = require('../src/core/domain-exceptions/utility.exceptions');
      const ex = new InvalidPeriodDateException('بداية التاريخ بعد النهاية');
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('INVALID_PERIOD_DATE');
    });
  });

  describe('7. Domain Exceptions — Upload & Avatar', () => {
    it('InvalidImageFileException should have status 400 and INVALID_IMAGE_FILE', () => {
      const { InvalidImageFileException } = require('../src/core/domain-exceptions/upload.exceptions');
      const ex = new InvalidImageFileException('JPEG, PNG, WEBP');
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('INVALID_IMAGE_FILE');
      expect(res.message).toContain('JPEG, PNG, WEBP');
    });

    it('ImageSizeLimitException should have status 400 and IMAGE_SIZE_EXCEEDED', () => {
      const { ImageSizeLimitException } = require('../src/core/domain-exceptions/upload.exceptions');
      const ex = new ImageSizeLimitException(5);
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('IMAGE_SIZE_EXCEEDED');
      expect(res.message).toContain('5');
    });

    it('NoFileProvidedException should have status 400 and NO_FILE_PROVIDED', () => {
      const { NoFileProvidedException } = require('../src/core/domain-exceptions/upload.exceptions');
      const ex = new NoFileProvidedException();
      expect(ex.getStatus()).toBe(400);
      const res: any = ex.getResponse();
      expect(res.errorCategory).toBe('NO_FILE_PROVIDED');
    });
  });
});
