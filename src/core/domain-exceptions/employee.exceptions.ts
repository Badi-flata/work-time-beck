import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Domain Exceptions — الموظفين
 * أخطاء مخصصة لعمليات إدارة الموظفين
 */

export class EmployeeNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'الموظف المطلوب غير موجود',
      errorCategory: 'EMPLOYEE_NOT_FOUND',
    });
  }
}
export class RecordAttendancesEmployeeUndefindExcepion extends NotFoundException {
  constructor() {
    super({
      message: '  لم يتم أجد سجيل حضور الموظف ',
      errorCategory: 'RECORD_ATTENDANCES_EMPLOYEE_NOT_FOUND',
    });
  }
}

export class EmployeeAlreadyAssignedException extends BadRequestException {
  constructor() {
    super({
      message: 'هذا الموظف مسجل مسبقاً لدى مدير آخر',
      errorCategory: 'EMPLOYEE_ALREADY_ASSIGNED',
    });
  }
}
export class EmployeeAlreadyAssignedToYouException extends BadRequestException {
  constructor() {
    super({
      message: 'هذا الموظف مسجل مسبقاً لديك',
      errorCategory: 'EMPLOYEE_ALREADY_ASSIGNED_TO_YOU',
    });
  }
}

export class CannotAssignManagerAsEmployeeException extends BadRequestException {
  constructor() {
    super({
      message: 'العامل غير موجود أو ليس موظفاً',
      errorCategory: 'INVALID_ROLE_ASSIGNMENT',
    });
  }
}

export class EmployeeProfileNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'الملف الوظيفي للموظف غير موجود',
      errorCategory: 'EMPLOYEE_PROFILE_NOT_FOUND',
    });
  }
}
