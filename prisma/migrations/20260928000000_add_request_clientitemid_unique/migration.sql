-- AddUniqueConstraint
-- MySQL permits multiple NULL values in a unique index, so nullable clientItemId
-- rows are unaffected; only non-null clientItemId values must be unique per folder.
ALTER TABLE `collection_requests`
  ADD UNIQUE INDEX `collection_requests_folderId_clientItemId_key` (`folderId`, `clientItemId`);
