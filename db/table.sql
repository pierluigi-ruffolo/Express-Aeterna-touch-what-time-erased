-- 1. CREAZIONE TABELLE INDIPENDENTI (Senza Foreign Keys)
-- Queste devono essere create per prime.

CREATE TABLE `diets`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `description` TEXT NULL
);

CREATE TABLE `power_sources`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `description` TEXT NULL
);

CREATE TABLE `eras`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `period_start_mya` INT NOT NULL,
    `period_end_mya` INT NOT NULL
);

-- 2. CREAZIONE TABELLE PRINCIPALI

CREATE TABLE `products`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `price` DECIMAL(8, 2) NOT NULL,
    `is_featured` TINYINT NOT NULL,
    `url_image` VARCHAR(255) NULL DEFAULT 'placeholder.jpg',
    `dimension` VARCHAR(255) NOT NULL,
    `era_id` BIGINT UNSIGNED NOT NULL,
    `power_sources_id` BIGINT UNSIGNED NOT NULL, -- Rinominata per chiarezza
    `diet_id` BIGINT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `purchases`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `customer_email` VARCHAR(255) NOT NULL,
    `shipping_name` VARCHAR(255) NOT NULL,
    `shipping_surname` VARCHAR(255) NOT NULL,
    `shipping_street` VARCHAR(255) NOT NULL,
    `shipping_city` VARCHAR(255) NOT NULL,
    `shipping_postcode` VARCHAR(255) NOT NULL,
    `shipping_province_state` VARCHAR(255) NOT NULL,
    `shipping_country` VARCHAR(255) NOT NULL,
    `subtotal` DECIMAL(8, 2) NOT NULL,
    `shipping_cost` DECIMAL(8, 2) NOT NULL DEFAULT '0',
    `total_amount` DECIMAL(8, 2) NOT NULL,
    `payment_method` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. TABELLE COLLEGATE (Relazioni Many-to-Many e One-to-One)

CREATE TABLE `purchase_product`(
    `product_id` BIGINT UNSIGNED NOT NULL,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (`product_id`, `purchase_id`) -- Aggiunta Primary Key composta
);

CREATE TABLE `invoices`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `purchase_id` BIGINT UNSIGNED NOT NULL UNIQUE,
    `invoice_number` VARCHAR(255) NOT NULL UNIQUE,
    `billing_name` VARCHAR(255) NOT NULL,
    `billing_surname` VARCHAR(255) NOT NULL,
    `billing_street` VARCHAR(255) NOT NULL,
    `billing_city` VARCHAR(255) NOT NULL,
    `billing_postcode` VARCHAR(255) NOT NULL,
    `billing_province_state` VARCHAR(255) NOT NULL,
    `billing_country` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. AGGIUNTA DEI VINCOLI (Foreign Keys)
-- Ora che tutte le tabelle esistono, colleghiamo i punti.

ALTER TABLE `products` 
    ADD CONSTRAINT `products_era_id_foreign` FOREIGN KEY(`era_id`) REFERENCES `eras`(`id`),
    ADD CONSTRAINT `products_diet_id_foreign` FOREIGN KEY(`diet_id`) REFERENCES `diets`(`id`),
    ADD CONSTRAINT `products_power_sources_foreign` FOREIGN KEY(`power_sources_id`) REFERENCES `power_sources`(`id`);

ALTER TABLE `invoices` 
    ADD CONSTRAINT `invoices_purchase_id_foreign` FOREIGN KEY(`purchase_id`) REFERENCES `purchases`(`id`);

ALTER TABLE `purchase_product` 
    ADD CONSTRAINT `purchase_product_product_id_foreign` FOREIGN KEY(`product_id`) REFERENCES `products`(`id`),
    ADD CONSTRAINT `purchase_product_purchase_id_foreign` FOREIGN KEY(`purchase_id`) REFERENCES `purchases`(`id`);