# ══════════════════════════════════════════════
# Stage 1: Builder — يبني dist/ ويولّد Prisma Client
# ══════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# نسخ ملفات التبعيات أولاً (لاستفادة من Docker cache)
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/

# تثبيت جميع التبعيات (بما فيها devDependencies) لإتمام البناء
RUN npm ci

# توليد Prisma Client
RUN npx prisma generate

# نسخ بقية الكود وبناء المشروع
COPY . .
RUN npm run build

# ══════════════════════════════════════════════
# Stage 2: Production — صورة نظيفة وخفيفة للتشغيل
# ══════════════════════════════════════════════
FROM node:20-alpine AS production

WORKDIR /app

# نسخ ملفات التبعيات
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/

# تثبيت تبعيات الإنتاج فقط
RUN npm ci --omit=dev

# توليد Prisma Client في بيئة الإنتاج
RUN npx prisma generate

# نسخ الكود المبني من مرحلة Builder
COPY --from=builder /app/dist ./dist

# المنفذ الذي يعمل عليه NestJS
EXPOSE 3000

# تشغيل التطبيق
CMD ["node", "dist/main"]
