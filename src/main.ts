import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // تفعيل CORS للسماح للواجهة الأمامية بالاتصال
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // تفعيل التحقق التلقائي من البيانات المدخلة عبر DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // يحذف الحقول غير المعرفة في الـ DTO
      forbidNonWhitelisted: true, // يرفض الطلب إذا أرسل حقول غير معرفة
      transform: true,            // يحول القيم للأنواع المطلوبة تلقائياً
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 9000);
}
bootstrap();
