/*
  Warnings:

  - You are about to drop the column `create_at` on the `answers` table. All the data in the column will be lost.
  - You are about to drop the column `update_at` on the `answers` table. All the data in the column will be lost.
  - You are about to drop the column `class_weekday_id` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the column `start_end` on the `classes` table. All the data in the column will be lost.
  - You are about to drop the `historys` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `exam_id` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `is_correct` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `answers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_time` to the `class_weekdays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `end_date` to the `classes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'Hủy giao dịch';

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_class_weekday_id_fkey";

-- DropForeignKey
ALTER TABLE "historys" DROP CONSTRAINT "historys_answer_id_fkey";

-- DropForeignKey
ALTER TABLE "historys" DROP CONSTRAINT "historys_exam_id_fkey";

-- DropForeignKey
ALTER TABLE "historys" DROP CONSTRAINT "historys_user_id_fkey";

-- DropIndex
DROP INDEX "blogs_menu_id_key";

-- DropIndex
DROP INDEX "blogs_user_id_key";

-- DropIndex
DROP INDEX "class_students_class_id_key";

-- DropIndex
DROP INDEX "class_students_student_id_key";

-- DropIndex
DROP INDEX "courses_menu_id_key";

-- DropIndex
DROP INDEX "exams_name_key";

-- DropIndex
DROP INDEX "menus_name_key";

-- DropIndex
DROP INDEX "menus_sort_key";

-- DropIndex
DROP INDEX "staffs_user_id_key";

-- DropIndex
DROP INDEX "subjects_name_key";

-- DropIndex
DROP INDEX "teachers_user_id_key";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "answers" DROP COLUMN "create_at",
DROP COLUMN "update_at",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "exam_id" INTEGER NOT NULL,
ADD COLUMN     "is_correct" BOOLEAN NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "description" TEXT,
ADD COLUMN     "image_title" TEXT,
ALTER COLUMN "title" DROP NOT NULL;

-- AlterTable
ALTER TABLE "class_weekdays" ADD COLUMN     "start_time" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "classes" DROP COLUMN "class_weekday_id",
DROP COLUMN "start_end",
ADD COLUMN     "end_date" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "menus" ADD COLUMN     "slug" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "vnp_txn_ref" TEXT;

-- DropTable
DROP TABLE "historys";

-- CreateTable
CREATE TABLE "histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL,
    "correct_answer" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" SERIAL NOT NULL,
    "class_id" INTEGER NOT NULL,
    "weekday_id" INTEGER NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "histories_user_id_exam_id_idx" ON "histories"("user_id", "exam_id");

-- CreateIndex
CREATE INDEX "histories_deleted_at_idx" ON "histories"("deleted_at");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE INDEX "answers_user_id_exam_id_idx" ON "answers"("user_id", "exam_id");

-- CreateIndex
CREATE INDEX "answers_deleted_at_idx" ON "answers"("deleted_at");

-- CreateIndex
CREATE INDEX "elements_group_id_idx" ON "elements"("group_id");

-- CreateIndex
CREATE INDEX "elements_question_id_idx" ON "elements"("question_id");

-- CreateIndex
CREATE INDEX "question_groups_part_id_exam_id_idx" ON "question_groups"("part_id", "exam_id");

-- CreateIndex
CREATE INDEX "question_groups_deleted_at_idx" ON "question_groups"("deleted_at");

-- CreateIndex
CREATE INDEX "questions_group_id_idx" ON "questions"("group_id");

-- CreateIndex
CREATE INDEX "questions_deleted_at_idx" ON "questions"("deleted_at");

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histories" ADD CONSTRAINT "histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histories" ADD CONSTRAINT "histories_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_weekday_id_fkey" FOREIGN KEY ("weekday_id") REFERENCES "class_weekdays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
