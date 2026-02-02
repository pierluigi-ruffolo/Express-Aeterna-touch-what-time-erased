

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
    `display_period` VARCHAR(255) NOT NULL -- Esempio: "Da 252 a 66 milioni di anni fa"
);



CREATE TABLE `products`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `price` DECIMAL(12, 2) NOT NULL, -- Prezzo aumentato per sicurezza
    `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
    `url_image` VARCHAR(255) NULL DEFAULT 'placeholder.jpg',
    `dimension` ENUM('Small', 'Medium', 'Large', 'Extra Large') NOT NULL, -- ENUM è più pulito
    `era_id` BIGINT UNSIGNED NOT NULL,
    `power_source_id` BIGINT UNSIGNED NOT NULL, 
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
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `shipping_cost` DECIMAL(12, 2) NOT NULL DEFAULT '0',
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `payment_method` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);



CREATE TABLE `purchase_product`(
    `product_id` BIGINT UNSIGNED NOT NULL,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(8, 2) NOT NULL,
    PRIMARY KEY (`product_id`, `purchase_id`) 
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



ALTER TABLE `products` 
    ADD CONSTRAINT `products_era_id_foreign` FOREIGN KEY(`era_id`) REFERENCES `eras`(`id`),
    ADD CONSTRAINT `products_diet_id_foreign` FOREIGN KEY(`diet_id`) REFERENCES `diets`(`id`),
    -- Corretto il nome colonna da power_sources_id a power_source_id
    ADD CONSTRAINT `products_power_source_id_foreign` FOREIGN KEY(`power_source_id`) REFERENCES `power_sources`(`id`);

ALTER TABLE `invoices` 
    ADD CONSTRAINT `invoices_purchase_id_foreign` FOREIGN KEY(`purchase_id`) REFERENCES `purchases`(`id`);

ALTER TABLE `purchase_product` 
    ADD CONSTRAINT `purchase_product_product_id_foreign` FOREIGN KEY(`product_id`) REFERENCES `products`(`id`),
    ADD CONSTRAINT `purchase_product_purchase_id_foreign` FOREIGN KEY(`purchase_id`) REFERENCES `purchases`(`id`);




    