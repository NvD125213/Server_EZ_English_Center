import prisma from "../config/prisma";
import { createVNPayChecksum } from "../libs/vnpayment";
import { htmlPaymentForm } from "../utils/paymentForm";
import { Request, Response, RequestHandler } from "express";
import { sendPaymentConfirmation } from "../libs/mailer";
import { io } from "../index";

export const PaymentController = {
  handlePaymentReturn: (async (req: Request, res: Response): Promise<void> => {
    const vnp_Params = req.query;

    const secureHash = vnp_Params.vnp_SecureHash as string;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const checkSum = createVNPayChecksum(
      vnp_Params,
      process.env.VNP_HASHSECRET!
    );

    if (secureHash !== checkSum) {
      const message = "Thanh toán thất bại";
      res.status(400).send(htmlPaymentForm(message));
      return;
    }

    try {
      const transactionRef = vnp_Params.vnp_TxnRef as string;
      const responseCode = vnp_Params.vnp_ResponseCode as string;

      const payment = await prisma.payment.findFirst({
        where: {
          vnp_txn_ref: transactionRef,
        },
        include: {
          student: true,
          class: {
            include: {
              course: {
                include: {
                  menu: true,
                },
              },
              address: true,
              class_schedules: {
                include: {
                  weekday: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (responseCode === "00") {
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            payment_date: new Date(),
          },
          include: {
            student: true,
            class: {
              include: {
                course: {
                  include: {
                    menu: true,
                  },
                },
              },
            },
          },
        });

        // Emit payment status update event with all necessary data
        io.emit("paymentStatusUpdate", {
          class_id: payment.class_id,
          payment: {
            ...updatedPayment,
            student: {
              id: updatedPayment.student.id,
              name: updatedPayment.student.name,
              email: updatedPayment.student.email,
            },
            class: {
              id: updatedPayment.class.id,
              name: updatedPayment.class.name,
              course: {
                id: updatedPayment.class.course.id,
                name: updatedPayment.class.course.menu.name,
              },
            },
          },
        });

        try {
          const classSchedules = payment.class.class_schedules.map(
            (schedule) => ({
              week_day: schedule.weekday.week_day,
              hours: schedule.weekday.hours,
              start_time: schedule.weekday.start_time,
            })
          );

          await sendPaymentConfirmation(
            payment.student.email,
            payment.class.course.menu.name,
            payment.class.name,
            payment.class.start_date,
            Number(payment.amount),
            classSchedules,
            {
              street: payment.class.address.street,
              ward: payment.class.address.ward,
              district: payment.class.address.district,
              province: payment.class.address.province,
            }
          );
        } catch (emailError) {
          console.error("Lỗi gửi email xác nhận:", emailError);
        }

        const message = "Đăng ký khóa học thành công";
        res.status(200).send(htmlPaymentForm(message));
        return;
      } else {
        const updatedPayment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "REJECTED",
            payment_date: new Date(),
          },
          include: {
            student: true,
            class: {
              include: {
                course: {
                  include: {
                    menu: true,
                  },
                },
              },
            },
          },
        });

        // Emit payment status update event for failed payment
        io.emit("paymentStatusUpdate", {
          class_id: payment.class_id,
          payment: {
            ...updatedPayment,
            student: {
              id: updatedPayment.student.id,
              name: updatedPayment.student.name,
              email: updatedPayment.student.email,
            },
            class: {
              id: updatedPayment.class.id,
              name: updatedPayment.class.name,
              course: {
                id: updatedPayment.class.course.id,
                name: updatedPayment.class.course.menu.name,
              },
            },
          },
        });

        const message = "Giao dịch bị lỗi";
        res.status(200).send(htmlPaymentForm(message));
        return;
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      res.status(500).json({
        message: "Lỗi không xác định",
        error: error.message,
      });
      return;
    }
  }) as RequestHandler,
};
