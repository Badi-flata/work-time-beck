import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Domain Exceptions — إدارة المدير وفريق العمل (Managing & Manager Exceptions)
 * أخطاء مخصصة لعمليات إدارة الموظفين، مراجعة الأعذار، الخصومات، ولوحة تحكم المدير
 */

export class ManagerProfileNotFoundException extends UnauthorizedException {
  constructor() {
    super({
      message: 'المدير غير موجود أو ليس لديه ملف مدير',
      errorCategory: 'MANAGER_PROFILE_NOT_FOUND',
    });
  }
}

export class ExcuseNotFoundException extends NotFoundException {
  constructor() {
    super({
      message: 'العذر المطلوب غير موجود في النظام',
      errorCategory: 'EXCUSE_NOT_FOUND',
    });
  }
}

export class ExcuseAlreadyApprovedException extends ConflictException {
  constructor() {
    super({
      message: 'تمت معالجة وقبول هذا العذر مسبقاً',
      errorCategory: 'EXCUSE_ALREADY_APPROVED',
    });
  }
}

export class EmployeeNotUnderManagerException extends ForbiddenException {
  constructor() {
    super({
      message: 'الموظف المحدد لا يتبع لإدارتك أو غير مسجل في فريقك',
      errorCategory: 'EMPLOYEE_NOT_UNDER_MANAGER',
    });
  }
}

export class AuditEmployeeFailedException extends BadRequestException {
  constructor(details?: string) {
    super({
      message: details
        ? `فشل في تدقيق بيانات الموظف: ${details}`
        : 'خطأ أثناء تدقيق وتعديل بيانات الموظف',
      errorCategory: 'AUDIT_EMPLOYEE_FAILED',
    });
  }
}

export class SalaryDeductionFailedException extends BadRequestException {
  constructor(details?: string) {
    super({
      message: details
        ? `تعذر تطبيق خصم الراتب: ${details}`
        : 'تعذر تطبيق الخصم اليومي على راتب الموظف',
      errorCategory: 'SALARY_DEDUCTION_FAILED',
    });
  }
}
