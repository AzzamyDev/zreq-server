-- Narrow sort + covering index for ORDER BY createdAt on large rows (MySQL ER_OUT_OF_SORTMEMORY 1038)
CREATE INDEX `Collection_workspaceId_createdAt_idx` ON `Collection`(`workspaceId`, `createdAt`);
CREATE INDEX `Environment_userId_createdAt_idx` ON `Environment`(`userId`, `createdAt`);
