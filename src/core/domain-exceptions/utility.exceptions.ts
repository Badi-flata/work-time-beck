import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

/**
 * Domain Exceptions — العمليات الإحصائية والحسابية والخدمات المساندة (Utility Exceptions)
 * أخطاء مخصصة لاحتساب الفترات الزمنية، تقارير الحضور، والتحقق التلقائي
 */

export class AttendanceRecordsNotFoundException extends NotFoundException {
  constructor(date?: string, mode?: string) {
    super({
      message: date || mode
        ? `لم يتم العثور على سجلات حضور للفترة المحددة (${mode || ''} - ${date || ''})`
        : 'لم يتم العثور على أي سجلات حضور للفترة المحددة',
      errorCategory: 'ATTENDANCE_RECORDS_NOT_FOUND',
    });
  }
}

export class InvalidPeriodDateException extends BadRequestException {
  constructor(reason?: string) {
    super({
      message: reason
        ? `تاريخ الفترة المحددة غير صالح: ${reason}`
        : 'التاريخ أو النطاق الزمني المحدد غير صالح',
      errorCategory: 'INVALID_PERIOD_DATE',
    });
  }
}

export class AutoCheckExecutionException extends InternalServerErrorException {
  constructor(details?: string) {
    super({
      message: details
        ? `فشل في معالجة التحقق التلقائي للحضور: ${details}`
        : 'حدث خطأ أثناء تشغيل عملية التحقق التلقائي من الحضور والغياب',
      errorCategory: 'AUTO_CHECK_EXECUTION_FAILED',
    });
  }
}

export class SearchTermTooShortException extends BadRequestException {
  constructor(minLength = 2) {
    super({
      message: `يجب أن تتكون عبارة البحث من ${minLength} أحرف على الأقل`,
      errorCategory: 'SEARCH_TERM_TOO_SHORT',
    });
  }
}
