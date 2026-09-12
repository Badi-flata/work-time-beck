import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. Generate unique Trace ID for cross-system correlation
    const traceId = `tr_${randomUUID().replace(/-/g, '').substring(0, 10)}`;

    // 2. Extract User info
    const user = (request as any).user;
    const affectedUser = user
      ? {
          userId: user.userId || user.id || 'N/A',
          email: user.email || 'N/A',
          role: user.role || 'N/A',
        }
      : null;

    const isDev = process.env.NODE_ENV === 'development';
    const isAdmin = user?.role === 'SUPER_ADMIN';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً.';
    let errorCategory = 'SYSTEM_INTERNAL_ERROR';
    let rawCause: any = null;

    // 3. Exception Classification
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as any;
        rawCause = resObj.message || exception.message;

        if (typeof resObj === 'object' && resObj.errorCategory) {
          errorCategory = resObj.errorCategory;
          message = resObj.message || exception.message;
        } else if (Array.isArray(resObj.message)) {
          const validationErrors = resObj.message as string[];
          message = `البيانات المدخلة غير صحيحة (${validationErrors.length} خطأ). يرجى تصحيح الأخطاء التالية: ${validationErrors.join(' | ')}`;
          errorCategory = 'VALIDATION_ERROR';
          rawCause = {
            type: 'VALIDATION_ERRORS',
            errors: validationErrors,
            count: validationErrors.length,
          };
        } else {
          message = resObj.message || exception.message;
        }
      } else {
        message = exception.message;
      }

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') errorCategory = 'BAD_REQUEST';
          break;
        case HttpStatus.UNAUTHORIZED:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') {
            errorCategory = 'UNAUTHENTICATED';
          }
          if (!message || message === 'Unauthorized') {
            message = 'يرجى تسجيل الدخول بشكل صحيح للوصول إلى هذا المورد.';
          }
          break;
        case HttpStatus.FORBIDDEN:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') {
            errorCategory = 'UNAUTHORIZED_ACCESS';
          }
          if (!message || message === 'Forbidden') {
            message = 'عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذا المورد.';
          }
          break;
        case HttpStatus.NOT_FOUND:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') {
            errorCategory = 'NOT_FOUND';
          }
          if (!message || message === 'Not Found') {
            message = 'عذراً، المورد الذي تحاول الوصول إليه غير موجود.';
          }
          break;
        case HttpStatus.CONFLICT:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') {
            errorCategory = 'RESOURCE_CONFLICT';
          }
          if (!message || message === 'Conflict') {
            message = 'توجد بيانات مسجلة مسبقاً تتعارض مع هذا الطلب.';
          }
          break;
        default:
          if (errorCategory === 'SYSTEM_INTERNAL_ERROR') {
            errorCategory = 'HTTP_CLIENT_ERROR';
          }
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      errorCategory = 'DATABASE_CONSTRAINT_ERROR';
      rawCause = {
        code: exception.code,
        meta: exception.meta,
        message: exception.message,
      };

      switch (exception.code) {
        case 'P1000':
        case 'P1001':
        case 'P1002':
        case 'P1003':
        case 'P1017':
          status = HttpStatus.SERVICE_UNAVAILABLE;
          errorCategory = 'DATABASE_CONNECTION_UNAVAILABLE';
          message = 'تعذر الاتصال بقاعدة البيانات في الوقت الحالي. يرجى المحاولة لاحقاً.';
          break;
        case 'P2002':
          status = HttpStatus.CONFLICT;
          errorCategory = 'DUPLICATE_RESOURCE_CONFLICT';
          if (isAdmin || isDev) {
            const targetFields = exception.meta?.target
              ? ` (${(exception.meta.target as string[]).join(', ')})`
              : '';
            const model = (exception.meta?.modelName as string) || '';
            const modelMessages: Record<string, string> = {
              Department: `يوجد قسم بنفس الاسم مسبقاً${targetFields}. يرجى اختيار اسم مختلف.`,
              Shift: `توجد وردية بنفس البيانات مسبقاً${targetFields}.`,
              User: `يوجد مستخدم بنفس البيانات مسبقاً${targetFields}.`,
              Attendance: `تم تسجيل الحضور مسبقاً لهذا اليوم${targetFields}.`,
            };
            message = modelMessages[model] || `تم إدخال قيمة مسجلة مسبقاً في النظام${targetFields}.`;
          } else {
            message = 'عذراً، البيانات التي تحاول إدخالها مسجلة مسبقاً في النظام ولا يمكن تكرارها.';
          }
          break;
        case 'P2003':
          errorCategory = 'FOREIGN_KEY_CONSTRAINT_FAILED';
          message = 'خطأ في ترابط البيانات: العنصر المرتبط المشار إليه غير موجود.';
          break;
        case 'P2014':
          message = 'لا يمكن إتمام عملية الحذف نظراً لارتباط هذا السجل ببيانات أخرى.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          errorCategory = 'RECORD_NOT_FOUND';
          message = 'السجل المطلوب تعديله أو حذفه غير موجود في النظام.';
          break;
        default:
          message = 'فشلت معالجة الطلب في قاعدة البيانات بسبب مشكلة في البيانات المدخلة.';
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      errorCategory = 'PRISMA_QUERY_VALIDATION_ERROR';
      rawCause = exception.message;
      message = 'توجد حقول مفقودة أو غير صالحة في استعلام قاعدة البيانات.';
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      errorCategory = 'DATABASE_INITIALIZATION_ERROR';
      rawCause = exception.message;
      message = 'فشل النظام في تهيئة الاتصال بقاعدة البيانات.';
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCategory = 'UNCAUGHT_RUNTIME_ERROR';
      rawCause = exception.message;
      message = 'حدث خطأ غير متوقع أثناء معالجة طلبك، تم تسجيل المشكلة للتحقق.';
    }

    // 4. Server-Side Logging with Trace ID
    const logDetails = {
      traceId,
      method: request.method,
      url: request.url,
      statusCode: status,
      category: errorCategory,
      affectedUser,
      query: request.query,
      requestBody: isDev ? request.body : undefined,
      systemMessage: exception instanceof Error ? exception.message : String(exception),
    };

    this.logger.error(
      `[AllExceptionsFilter] [Trace: ${traceId}] [${errorCategory}] [Status: ${status}] ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(logDetails)
    );

    // 5. Build Unified JSON Response
    const showCause = isAdmin || isDev;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      errorCategory,
      message,
      traceId,
      cause: showCause ? rawCause : undefined,
      affectedUser: showCause ? affectedUser : undefined,
    });
  }
}
