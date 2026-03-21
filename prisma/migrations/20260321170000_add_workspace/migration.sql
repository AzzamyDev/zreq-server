CREATE TABLE `Workspace` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `Workspace` (`name`, `userId`, `createdAt`, `updatedAt`)
SELECT 'Default', `id`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3) FROM `User`;

ALTER TABLE `Collection` ADD COLUMN `workspaceId` INTEGER NULL;

UPDATE `Collection` c
SET c.`workspaceId` = (
    SELECT w.`id` FROM `Workspace` w WHERE w.`userId` = c.`userId` ORDER BY w.`id` ASC LIMIT 1
);

ALTER TABLE `Collection` MODIFY `workspaceId` INTEGER NOT NULL;

ALTER TABLE `Collection` ADD CONSTRAINT `Collection_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
