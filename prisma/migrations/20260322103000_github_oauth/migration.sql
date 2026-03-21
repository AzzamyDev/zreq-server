-- AlterTable
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `githubId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_githubId_key` ON `User`(`githubId`);
