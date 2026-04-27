import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const fallbackConnectionString = "postgresql://placeholder:placeholder@localhost:5432/dentastock?schema=public";
const connectionString = process.env.DATABASE_URL || fallbackConnectionString;

export const hasConfiguredDatabaseUrl =
  Boolean(process.env.DATABASE_URL) && !process.env.DATABASE_URL?.includes("johndoe:randompassword");

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const prisma =
  global.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
