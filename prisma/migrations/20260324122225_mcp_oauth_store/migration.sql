-- CreateTable
CREATE TABLE `OAuthClientStore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` VARCHAR(191) NOT NULL,
    `clientSecret` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `clientDescription` VARCHAR(191) NULL,
    `logoUri` VARCHAR(191) NULL,
    `clientUri` VARCHAR(191) NULL,
    `developerName` VARCHAR(191) NULL,
    `developerEmail` VARCHAR(191) NULL,
    `redirectUris` JSON NOT NULL,
    `grantTypes` JSON NOT NULL,
    `responseTypes` JSON NOT NULL,
    `tokenEndpointAuthMethod` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OAuthClientStore_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthAuthorizationCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `redirectUri` VARCHAR(191) NOT NULL,
    `codeChallenge` VARCHAR(191) NOT NULL,
    `codeChallengeMethod` VARCHAR(191) NOT NULL,
    `resource` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `expiresAt` BIGINT NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `userProfileId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OAuthAuthorizationCode_code_key`(`code`),
    INDEX `OAuthAuthorizationCode_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthSessionStore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `redirectUri` VARCHAR(191) NULL,
    `codeChallenge` VARCHAR(191) NULL,
    `codeChallengeMethod` VARCHAR(191) NULL,
    `oauthState` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `resource` VARCHAR(191) NULL,
    `expiresAt` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OAuthSessionStore_sessionId_key`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OAuthUserProfileStore` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `profileId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerUserId` VARCHAR(191) NOT NULL,
    `profile` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OAuthUserProfileStore_profileId_key`(`profileId`),
    UNIQUE INDEX `OAuthUserProfileStore_provider_providerUserId_key`(`provider`, `providerUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
