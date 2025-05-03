/*
  Warnings:

  - Added the required column `exam_id` to the `question_groups` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "question_groups" ADD COLUMN     "exam_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
