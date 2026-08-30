import { BadRequestException } from '@nestjs/common';

/**
 * Domain Exceptions — رفع الملفات والصور (Upload Exceptions)
 * أخطاء مخصصة للتحقق من نوع وحجم الملفات المرفوعة
 */

export class InvalidImageFileException extends BadRequestException {
  constructor(allowedTypes = 'JPEG, PNG, WEBP') {
    super({
      message: `صيغة الملف غير مدعومة، يُسمح فقط بصيغ الصور التالية: (${allowedTypes})`,
      errorCategory: 'INVALID_IMAGE_FILE',
    });
  }
}

export class ImageSizeLimitException extends BadRequestException {
  constructor(maxSizeMb = 5) {
    super({
      message: `حجم الصورة يتجاوز الحد المسموح به (${maxSizeMb} ميجابايت)`,
      errorCategory: 'IMAGE_SIZE_EXCEEDED',
    });
  }
}

export class NoFileProvidedException extends BadRequestException {
  constructor() {
    super({
      message: 'لم يتم إرفاق أي ملف في الطلب',
      errorCategory: 'NO_FILE_PROVIDED',
    });
  }
}
