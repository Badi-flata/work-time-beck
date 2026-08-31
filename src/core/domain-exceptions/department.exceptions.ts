import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Domain Exceptions — الأقسام
 * أخطاء مخصصة لعمليات إدارة الأقسام
 */

export class DepartmentNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'القسم المطلوب غير موجود',
      errorCategory: 'DEPARTMENT_NOT_FOUND',
    });
  }
}

export class DepartmentHasEmployeesException extends BadRequestException {
  constructor(count?: number) {
    super({
      message: count
        ? `لا يمكن حذف القسم لأنه يحتوي على ${count} موظف. يرجى نقلهم أولاً.`
        : 'لا يمكن حذف القسم نظراً لوجود موظفين مرتبطين به',
      errorCategory: 'DEPARTMENT_HAS_EMPLOYEES',
    });
  }
}

export class DuplicateDepartmentException extends ConflictException {
  constructor(name?: string) {
    super({
      message: name
        ? `القسم "${name}" موجود بالفعل`
        : 'القسم موجود بالفعل',
      errorCategory: 'DEPARTMENT_DUPLICATE',
    });
  }
}

export { ManagerProfileNotFoundException } from './managing.exceptions';
