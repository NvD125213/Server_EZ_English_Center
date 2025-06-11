import cron from "node-cron";
import prisma from "../config/prisma";
export function startPaymentTimeoutChecker() {
    cron.schedule("*/5 * * * *", async () => {
        console.log("[CRON] Kiểm tra giao dịch thanh toán quá hạn...");
        const timeoutMinutes = 15;
        const expiredDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);
        console.log("[CRON] Thời gian hiện tại:", new Date(Date.now()));
        console.log("[CRON] Thời gian hết hạn:", expiredDate);
        try {
            const expiredPayments = await prisma.payment.findMany({
                where: {
                    status: { in: ["PENDING", "REJECTED", "CANCELLED"] },
                    payment_date: { lt: expiredDate },
                },
                include: {
                    student: {
                        include: {
                            user: true,
                        },
                    },
                },
            });
            console.log("[CRON] Giao dịch tìm thấy:", expiredPayments);
            if (expiredPayments.length === 0) {
                console.log("[CRON] Không có giao dịch nào quá hạn.");
                return;
            }
            for (const payment of expiredPayments) {
                await prisma.$transaction(async (tx) => {
                    await tx.class_Student.deleteMany({
                        where: {
                            class_id: payment.class_id,
                            student_id: payment.student.id,
                        },
                    });
                    await tx.payment.delete({ where: { id: payment.id } });
                    await tx.student.delete({ where: { id: payment.student.id } });
                    if (payment.student.user) {
                        await tx.user.delete({ where: { id: payment.student.user.id } });
                    }
                });
                console.log(`[CRON] Đã xóa payment #${payment.id} và dữ liệu liên quan do timeout.`);
            }
        }
        catch (error) {
            console.error("[CRON] Lỗi khi xử lý cron kiểm tra payment timeout:", error);
        }
    });
}
