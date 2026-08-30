import { ConflictException, ForbiddenException } from '@nestjs/common';

/**
 * Domain Exceptions — الحضور والانصراف
 * أخطاء مخصصة لعمليات تسجيل الحضور والانصراف
 */

export class AlreadyCheckedInException extends ConflictException {
  constructor() {
    super({
      message: 'تم تسجيل الحضور بالفعل',
      errorCategory: 'ATTENDANCE_DUPLICATE_CHECKIN',
    });
  }
}

export class AlreadyCheckedOutException extends ConflictException {
  constructor() {
    super({
      message: 'تم تسجيل الإنصراف بالفعل',
      errorCategory: 'ATTENDANCE_DUPLICATE_CHECKOUT',
    });
  }
}

export class CheckInExpiredException extends ForbiddenException {
  constructor() {
    super({
      message: 'لا يمكن تسجيل الحضور في سجل قديم',
      errorCategory: 'ATTENDANCE_EXPIRED_CHECKIN',
    });
  }
}

export class CheckOutBeforeCheckInException extends ForbiddenException {
  constructor() {
    super({
      message: 'لا يمكن تسجيل الانصراف قبل تسجيل الحضور',
      errorCategory: 'ATTENDANCE_NO_CHECKIN',
    });
  }
}

export class CheckOutExpiredException extends ForbiddenException {
  constructor() {
    super({
      message: 'لا يمكن تسجيل الانصراف في سجل حضور قديم',
      errorCategory: 'ATTENDANCE_EXPIRED_CHECKOUT',
    });
  }
}
