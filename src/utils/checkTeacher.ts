import prisma from "../config/prisma.js";

export const checkTeacherScheduleConflict = async (
  teacherId: number,
  weekdays: Array<{ week_day: number; hours: number; start_time: string }>,
  excludeClassId?: number,
  newClassStartDate?: Date
): Promise<{ hasConflict: boolean; conflictDetails?: string }> => {
  // Get all active classes of the teacher
  const teacherClasses = await prisma.class.findMany({
    where: {
      teacher_id: teacherId,
      deleted_at: null,
      ...(excludeClassId ? { id: { not: excludeClassId } } : {}),
      ...(newClassStartDate
        ? {
            end_date: { gt: newClassStartDate },
          }
        : {}),
    },
    include: {
      class_schedules: {
        where: {
          weekday: {
            deleted_at: null,
          },
        },
        include: {
          weekday: true,
        },
      },
    },
  });

  // Check for conflicts in each class
  for (const classData of teacherClasses) {
    if (newClassStartDate) {
      const existingEndDate = new Date(classData.end_date);
      const newStartDate = new Date(newClassStartDate);

      if (existingEndDate <= newStartDate) {
        continue;
      }
    }

    for (const schedule of classData.class_schedules) {
      const weekday = schedule.weekday;

      // Check if there's a conflict with any of the new weekdays
      for (const newWeekday of weekdays) {
        if (weekday.week_day === newWeekday.week_day) {
          // Convert times to minutes for easier comparison
          const existingStartTime = convertTimeToMinutes(weekday.start_time);
          const existingEndTime = existingStartTime + weekday.hours * 60;
          const newStartTime = convertTimeToMinutes(newWeekday.start_time);
          const newEndTime = newStartTime + newWeekday.hours * 60;

          // Check for time overlap
          if (
            (newStartTime >= existingStartTime &&
              newStartTime < existingEndTime) ||
            (newEndTime > existingStartTime && newEndTime <= existingEndTime) ||
            (newStartTime <= existingStartTime && newEndTime >= existingEndTime)
          ) {
            return {
              hasConflict: true,
              conflictDetails: `Xung đột với lớp ${classData.name} vào thứ ${
                weekday.week_day === 8 ? "Chủ nhật" : weekday.week_day
              } từ ${weekday.start_time} đến ${formatEndTime(
                weekday.start_time,
                weekday.hours
              )}`,
            };
          }
        }
      }
    }
  }

  return { hasConflict: false };
};

// Helper function to convert time string to minutes
const convertTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// Helper function to format end time
const formatEndTime = (startTime: string, hours: number): string => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const totalMinutes = startHours * 60 + startMinutes + hours * 60;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, "0")}:${endMinutes
    .toString()
    .padStart(2, "0")}`;
};
