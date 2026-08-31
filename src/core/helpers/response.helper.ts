import {
  ApiSuccessResponse,
  PaginationMeta,
} from '../interfaces/global-response.interface';

/**
 * ResponseHelper — دالة مساعدة لتوحيد بناء الاستجابات عبر كل الـ Services
 * تضمن أن كل الاستجابات تتبع نفس الشكل الموحد
 */
export class ResponseHelper {
  /**
   * استجابة ناجحة عامة (200)
   */
  static success<T>(
    data: T,
    message: string,
    statusCode = 200,
    meta?: PaginationMeta,
  ): ApiSuccessResponse<T> {
    return {
      statusCode,
      message,
      data,
      ...(meta && { meta }),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * استجابة إنشاء ناجحة (201)
   */
  static created<T>(data: T, message: string): ApiSuccessResponse<T> {
    return ResponseHelper.success(data, message, 201);
  }

  /**
   * استجابة مع تصفح (Pagination)
   */
  static paginated<T>(
    data: T[],
    totalItems: number,
    page: number,
    limit: number,
    message: string,
  ): ApiSuccessResponse<T[]> {
    const totalPages = Math.ceil(totalItems / limit);
    return ResponseHelper.success(data, message, 200, {
      page,
      limit,
      totalItems,
      totalPages,
    });
  }
}
