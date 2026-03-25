/*
  Warnings:

  - A unique constraint covering the columns `[userId,name]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Workspace_userId_name_key` ON `Workspace`(`userId`, `name`);
