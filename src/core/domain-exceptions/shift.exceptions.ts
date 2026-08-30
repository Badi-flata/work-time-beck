import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Domain Exceptions — الورديات
 * أخطاء مخصصة لعمليات إدارة الورديات
 */

export class ShiftNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'الوردية المطلوبة غير موجودة',
      errorCategory: 'SHIFT_NOT_FOUND',
    });
  }
}

export class ShiftHasEmployeesException extends BadRequestException {
  constructor(count?: number) {
    super({
      message: count
        ? `لا يمكن حذف الوردية لأنها مرتبطة بـ ${count} موظف. يرجى نقلهم أولاً.`
        : 'لا يمكن حذف الوردية نظراً لوجود موظفين مرتبطين بها',
      errorCategory: 'SHIFT_HAS_EMPLOYEES',
    });
  }
}

export class ShiftDepartmentNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'القسم المخصص للوردية غير موجود',
      errorCategory: 'SHIFT_DEPARTMENT_NOT_FOUND',
    });
  }
}
