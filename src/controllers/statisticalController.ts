import { Request, Response } from "express";
import prisma from "../config/prisma";

export const StatisticalController = {
  getAllUserStatistical: async (req: Request, res: Response): Promise<any> => {
    try {
      const total = await prisma.user.count({});
      return res.status(200).json({ total });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  getAllUserByMonth: async (req: Request, res: Response): Promise<any> => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      // Get first and last day of current month
      const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1);
      const lastDayCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

      // Get first and last day of previous month
      const firstDayPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
      const lastDayPreviousMonth = new Date(currentYear, currentMonth, 0);

      // Count users for current month
      const currentMonthUsers = await prisma.user.count({
        where: {
          create_at: {
            gte: firstDayCurrentMonth,
            lte: lastDayCurrentMonth,
          },
        },
      });

      // Count users for previous month
      const previousMonthUsers = await prisma.user.count({
        where: {
          create_at: {
            gte: firstDayPreviousMonth,
            lte: lastDayPreviousMonth,
          },
        },
      });

      // Calculate percentage change
      let percentageChange = 0;
      if (previousMonthUsers > 0) {
        percentageChange =
          ((currentMonthUsers - previousMonthUsers) / previousMonthUsers) * 100;
      } else if (currentMonthUsers > 0) {
        percentageChange = 100; // If previous month was 0 and current month has users
      }

      return res.status(200).json({
        currentMonthTotal: currentMonthUsers,
        previousMonthTotal: previousMonthUsers,
        percentageChange: Number(percentageChange.toFixed(2)),
        isIncrease: percentageChange >= 0,
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  getPaymentStatistical: async (req: Request, res: Response): Promise<any> => {
    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentDay = now.getDate();

      // Get first and last day of current month
      const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1);
      const lastDayCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

      // Get first and last day of previous month
      const firstDayPreviousMonth = new Date(currentYear, currentMonth - 1, 1);
      const lastDayPreviousMonth = new Date(currentYear, currentMonth, 0);

      // Get start and end of current day
      const startOfDay = new Date(
        currentYear,
        currentMonth,
        currentDay,
        0,
        0,
        0
      );
      const endOfDay = new Date(
        currentYear,
        currentMonth,
        currentDay,
        23,
        59,
        59
      );

      // Calculate total payment amount for current day
      const todayPayments = await prisma.payment.aggregate({
        where: {
          create_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate total payment amount for current month
      const currentMonthPayments = await prisma.payment.aggregate({
        where: {
          create_at: {
            gte: firstDayCurrentMonth,
            lte: lastDayCurrentMonth,
          },
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate total payment amount for previous month
      const previousMonthPayments = await prisma.payment.aggregate({
        where: {
          create_at: {
            gte: firstDayPreviousMonth,
            lte: lastDayPreviousMonth,
          },
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
      });

      // Convert Decimal to number and handle undefined cases
      const todayTotal = Number(todayPayments._sum?.amount || 0);
      const currentMonthTotal = Number(currentMonthPayments._sum?.amount || 0);
      const previousMonthTotal = Number(
        previousMonthPayments._sum?.amount || 0
      );

      // Calculate percentage change
      let percentageChange = 0;
      if (previousMonthTotal > 0) {
        percentageChange =
          ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
      } else if (currentMonthTotal > 0) {
        percentageChange = 100;
      }

      return res.status(200).json({
        todayTotal,
        currentMonthTotal,
        previousMonthTotal,
        percentageChange: Number(percentageChange.toFixed(2)),
        isIncrease: percentageChange >= 0,
      });
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  getPaymentStatisticalYear: async (
    req: Request,
    res: Response
  ): Promise<any> => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based

      const monthlyPayments = [];

      // Get payment counts for each month up to current month
      for (let month = 1; month <= currentMonth; month++) {
        const firstDayOfMonth = new Date(currentYear, month - 1, 1);
        const lastDayOfMonth = new Date(currentYear, month, 0);

        const paymentCount = await prisma.payment.count({
          where: {
            create_at: {
              gte: firstDayOfMonth,
              lte: lastDayOfMonth,
            },
            status: "COMPLETED",
          },
        });

        monthlyPayments.push({
          countPayment: paymentCount,
          month: month,
        });
      }

      return res.status(200).json(monthlyPayments);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },

  getCoursedFavorite: async (req: Request, res: Response): Promise<any> => {
    try {
      const courses = await prisma.course.findMany({
        select: {
          id: true,
          menu_id: true,
          classes: {
            select: {
              _count: {
                select: {
                  payments: {
                    where: {
                      status: "COMPLETED",
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Calculate payment counts and sort
      const coursesWithPaymentCount = await Promise.all(
        courses.map(async (course) => {
          const menu = await prisma.menu.findUnique({
            where: { id: course.menu_id },
            select: { name: true },
          });

          const totalPayments = course.classes.reduce(
            (total, cls) => total + cls._count.payments,
            0
          );

          return {
            id: course.id,
            menu_id: course.menu_id,
            menu_name: menu?.name || "Unknown Menu",
            total_payments: totalPayments,
          };
        })
      );

      // Sort by total_payments in descending order and take top 5
      const sortedCourses = coursesWithPaymentCount
        .sort((a, b) => b.total_payments - a.total_payments)
        .slice(0, 5);

      return res.status(200).json(sortedCourses);
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  },
};
