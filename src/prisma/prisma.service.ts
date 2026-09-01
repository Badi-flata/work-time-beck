import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

const getRuntimeDatabaseUrl = (): string => {
  const isProd =
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_STATIC_URL;

  if (isProd) {
    return (
      process.env.DATABASE_PUBLISH_URL ||
      process.env.DATABASE_PUBLIC_URL ||
      process.env.DATABASE_URL ||
      ""
    );
  }

  return (
    process.env.DATABASE_DEV_URL ||
    process.env.DATABASE_URL ||
    ""
  );
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const url = getRuntimeDatabaseUrl();
    super(
      url
        ? {
            datasources: {
              db: {
                url,
              },
            },
          }
        : undefined
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}