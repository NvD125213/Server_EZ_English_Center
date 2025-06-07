import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// Tạo một instance duy nhất của PrismaClient
const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

// Trong môi trường development, gán instance vào global để tránh tạo nhiều kết nối khi hot reload
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

// Xử lý sự kiện khi ứng dụng kết thúc
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

export default prisma;
