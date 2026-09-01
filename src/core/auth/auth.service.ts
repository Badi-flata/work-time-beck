import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // توليد زوج الرموز وتخزين جلسة الـ Refresh Token في قاعدة البيانات
  async generateTokenPair(username: string, userId: string, role: Role) {
    const accessPayload = { username, userId, role };
    // Access token (صلاحية 15 دقيقة)
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });

    // Refresh token فريد مشفر (صلاحية 7 أيام)
    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = this.hashToken(refreshTokenRaw);

    await this.prisma.refreshSession.create({
      data: {
        tokenHash,
        userId,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshTokenRaw,
      expires_in: 15 * 60,
    };
  }

  // تجديد الجلسة مع كشف إعادة الاستخدام (Token Reuse Detection)
  async refreshAccessToken(refreshTokenRaw: string) {
    if (!refreshTokenRaw) {
      throw new UnauthorizedException("لم يتم توفير رمز التجديد (Refresh Token).");
    }

    const tokenHash = this.hashToken(refreshTokenRaw);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // كشف استخدام نفس الـ Refresh Token بعد تدويره/إلغائه
    if (session && session.isRevoked) {
      // اشتباه اختراق: إلغاء جميع جلسات المستخدم فوراً لحمايته
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException("تم اكتشاف محاولة إعادة استخدام رمز تجديد منتهي/ملغي. تم تسجيل الخروج لجميع الجلسات حمايةً لحسابك.");
    }

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("رمز التجديد غير صالح أو منتهي الصلاحية.");
    }

    // إبطال الرمز القديم (Token Rotation)
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // إصدار زوج رموز جديد تماماً
    return this.generateTokenPair(
      session.user.fullName,
      session.user.id,
      session.user.role
    );
  }

  // تسجيل الخروج وإبطال جلسة المستخدم
  async revokeUserSessions(userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    return { message: "تم إبطال جميع الجلسات بنجاح" };
  }
}