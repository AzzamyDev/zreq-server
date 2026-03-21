-- Track last editor (JWT user) for collections, environments, and env variables
ALTER TABLE `Collection` ADD COLUMN `updatedByUserId` INTEGER NULL;
ALTER TABLE `Environment` ADD COLUMN `updatedByUserId` INTEGER NULL;
ALTER TABLE `EnvironmentVariable` ADD COLUMN `updatedByUserId` INTEGER NULL;

UPDATE `Collection` SET `updatedByUserId` = `userId` WHERE `updatedByUserId` IS NULL;
UPDATE `Environment` SET `updatedByUserId` = `userId` WHERE `updatedByUserId` IS NULL;

UPDATE `EnvironmentVariable` `ev`
INNER JOIN `Environment` `e` ON `e`.`id` = `ev`.`environmentId`
SET `ev`.`updatedByUserId` = `e`.`userId`
WHERE `ev`.`updatedByUserId` IS NULL;

ALTER TABLE `Collection` ADD CONSTRAINT `Collection_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Environment` ADD CONSTRAINT `Environment_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `EnvironmentVariable` ADD CONSTRAINT `EnvironmentVariable_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
