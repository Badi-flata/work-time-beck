import { ConflictException, UnauthorizedException } from '@nestjs/common';

/**
 * Domain Exceptions — المصادقة
 * أخطاء مخصصة لعمليات تسجيل الدخول وإنشاء الحسابات
 */

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super({
      message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      errorCategory: 'INVALID_CREDENTIALS',
    });
  }
}

export class EmailAlreadyExistsException extends ConflictException {
  constructor() {
    super({
      message: 'البريد الإلكتروني مسجل مسبقاً',
      errorCategory: 'EMAIL_DUPLICATE',
    });
  }
}

export class SessionExpiredException extends UnauthorizedException {
  constructor() {
    super({
      message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً',
      errorCategory: 'SESSION_EXPIRED',
    });
  }
}

export class InsufficientPermissionsException extends UnauthorizedException {
  constructor() {
    super({
      message: 'ليس لديك الصلاحية لإنشاء حساب مدير',
      errorCategory: 'INSUFFICIENT_PERMISSIONS',
    });
  }
}
