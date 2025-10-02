-- DropIndex
DROP INDEX "users_googleId_key";

-- DropIndex
DROP INDEX "users_phone_number_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "facebookId" TEXT,
ALTER COLUMN "phone_number" DROP NOT NULL,
ALTER COLUMN "phone_number" DROP DEFAULT,
ALTER COLUMN "password" DROP NOT NULL,
ALTER COLUMN "password" DROP DEFAULT;
