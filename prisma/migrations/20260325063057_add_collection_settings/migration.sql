-- AlterTable
ALTER TABLE `Collection` ADD COLUMN `auth` JSON NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `variables` JSON NULL;
