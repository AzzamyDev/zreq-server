-- Environment variable values (e.g. JWT access tokens) exceed VARCHAR(191).
ALTER TABLE `EnvironmentVariable` MODIFY `value` TEXT NOT NULL;
