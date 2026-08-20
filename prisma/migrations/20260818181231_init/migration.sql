-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'PENDING',
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `phone_verified` BOOLEAN NOT NULL DEFAULT false,
    `last_login` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `otp_codes` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `purpose` ENUM('LOGIN', 'PHONE_VERIFY', 'EMAIL_VERIFY', 'PASSWORD_RESET') NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_codes_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER') NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `role_permissions_role_permission_id_key`(`role`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,
    `allow` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `user_permissions_user_id_permission_id_key`(`user_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendors` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `vendor_code` VARCHAR(191) NOT NULL,
    `logo` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_APPROVAL') NOT NULL DEFAULT 'PENDING_APPROVAL',
    `plan_id` VARCHAR(191) NULL,
    `whatsapp_number` VARCHAR(191) NULL,
    `whatsapp_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendors_user_id_key`(`user_id`),
    UNIQUE INDEX `vendors_vendor_code_key`(`vendor_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `customer_code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_user_id_key`(`user_id`),
    UNIQUE INDEX `customers_customer_code_key`(`customer_code`),
    INDEX `customers_vendor_id_idx`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `event_code` VARCHAR(191) NOT NULL,
    `event_slug` VARCHAR(191) NOT NULL,
    `event_name` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `event_date` DATETIME(3) NULL,
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `timezone` VARCHAR(191) NULL DEFAULT 'Asia/Kolkata',
    `location` VARCHAR(191) NULL,
    `cover_image` VARCHAR(191) NULL,
    `page_title` VARCHAR(191) NULL,
    `live_timing` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'DRAFT',
    `theme_id` VARCHAR(191) NULL,
    `youtube_channel_id` VARCHAR(191) NULL,
    `youtube_video_id` VARCHAR(191) NULL,
    `youtube_live_url` VARCHAR(191) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `events_event_code_key`(`event_code`),
    UNIQUE INDEX `events_event_slug_key`(`event_slug`),
    INDEX `events_vendor_id_idx`(`vendor_id`),
    INDEX `events_customer_id_idx`(`customer_id`),
    INDEX `events_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `theme_categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `theme_categories_name_key`(`name`),
    UNIQUE INDEX `theme_categories_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `themes` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NULL,
    `preview_image` VARCHAR(191) NULL,
    `config` JSON NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DRAFT') NOT NULL DEFAULT 'DRAFT',
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `themes_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_themes` (
    `id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `theme_id` VARCHAR(191) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `vendor_themes_vendor_id_theme_id_key`(`vendor_id`, `theme_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_theme_config` (
    `id` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `theme_id` VARCHAR(191) NOT NULL,
    `primary_color` VARCHAR(191) NULL,
    `secondary_color` VARCHAR(191) NULL,
    `accent_color` VARCHAR(191) NULL,
    `logo` VARCHAR(191) NULL,
    `cover_image` VARCHAR(191) NULL,
    `page_title` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `live_timing` VARCHAR(191) NULL,
    `custom_config` JSON NULL,

    UNIQUE INDEX `event_theme_config_event_id_key`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_media` (
    `id` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `type` ENUM('COVER', 'GALLERY', 'TEASER', 'CUSTOM', 'LOGO', 'WHATSAPP') NOT NULL,
    `file_url` VARCHAR(191) NOT NULL,
    `thumbnail_url` VARCHAR(191) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_media_event_id_idx`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_channels` (
    `id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `channel_id` VARCHAR(191) NOT NULL,
    `channel_name` VARCHAR(191) NULL,
    `access_token` TEXT NOT NULL,
    `refresh_token` TEXT NOT NULL,
    `token_expiry` DATETIME(3) NULL,
    `status` ENUM('CONNECTED', 'DISCONNECTED', 'ERROR', 'TOKEN_EXPIRED') NOT NULL DEFAULT 'CONNECTED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `youtube_channels_vendor_id_channel_id_key`(`vendor_id`, `channel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `youtube_streams` (
    `id` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `youtube_channel_id` VARCHAR(191) NOT NULL,
    `youtube_video_id` VARCHAR(191) NULL,
    `youtube_live_url` VARCHAR(191) NULL,
    `youtube_live_key` TEXT NULL,
    `status` ENUM('CONNECTED', 'SCHEDULED', 'LIVE', 'ENDED', 'ERROR') NOT NULL DEFAULT 'SCHEDULED',
    `scheduled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `youtube_streams_event_id_idx`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_access` (
    `id` VARCHAR(191) NOT NULL,
    `event_id` VARCHAR(191) NOT NULL,
    `access_type` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PUBLIC',
    `password_hash` VARCHAR(191) NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `event_access_event_id_key`(`event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `event_id` VARCHAR(191) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `gateway` VARCHAR(191) NOT NULL,
    `gateway_transaction_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor_wallets` (
    `id` VARCHAR(191) NOT NULL,
    `vendor_id` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vendor_wallets_vendor_id_key`(`vendor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `wallet_id` VARCHAR(191) NOT NULL,
    `type` ENUM('CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reference_type` VARCHAR(191) NULL,
    `reference_id` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wallet_transactions_wallet_id_idx`(`wallet_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER') NULL,
    `action` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NULL,
    `entity_id` VARCHAR(191) NULL,
    `old_data` JSON NULL,
    `new_data` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `otp_codes` ADD CONSTRAINT `otp_codes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_youtube_channel_id_fkey` FOREIGN KEY (`youtube_channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `themes` ADD CONSTRAINT `themes_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `theme_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_themes` ADD CONSTRAINT `vendor_themes_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_themes` ADD CONSTRAINT `vendor_themes_theme_id_fkey` FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_theme_config` ADD CONSTRAINT `event_theme_config_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_media` ADD CONSTRAINT `event_media_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_channels` ADD CONSTRAINT `youtube_channels_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_streams` ADD CONSTRAINT `youtube_streams_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `youtube_streams` ADD CONSTRAINT `youtube_streams_youtube_channel_id_fkey` FOREIGN KEY (`youtube_channel_id`) REFERENCES `youtube_channels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_access` ADD CONSTRAINT `event_access_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor_wallets` ADD CONSTRAINT `vendor_wallets_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `vendor_wallets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
