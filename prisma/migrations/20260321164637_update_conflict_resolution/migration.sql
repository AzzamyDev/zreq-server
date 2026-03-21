-- AlterTable
ALTER TABLE `EnvironmentVariable` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- RenameIndex
ALTER TABLE `Collection` RENAME INDEX `Collection_workspaceId_fkey` TO `Collection_workspaceId_idx`;

-- RenameIndex
ALTER TABLE `Workspace` RENAME INDEX `Workspace_userId_fkey` TO `Workspace_userId_idx`;
