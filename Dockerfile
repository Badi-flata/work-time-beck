# ══════════════════════════════════════════════
# Stage 1: Builder — يبني dist/ ويولّد Prisma Client
# ══════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/

# --ignore-scripts يمنع postinstall (prisma generate) من التشغيل المبكر
RUN npm ci --ignore-scripts

# توليد Prisma Client يدوياً (prisma موجود في devDependencies)
RUN npx prisma generate

# نسخ بقية الكود وبناء المشروع
COPY . .
RUN npm run build

# ══════════════════════════════════════════════
# Stage 2: Production — صورة نظيفة وخفيفة للتشغيل
# ══════════════════════════════════════════════
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/

# تثبيت تبعيات الإنتاج فقط (بدون devDeps، بدون postinstall)
RUN npm ci --omit=dev --ignore-scripts

# نسخ Prisma Client المولّد من مرحلة Builder (بدلاً من إعادة التوليد)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# نسخ الكود المبني من مرحلة Builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
