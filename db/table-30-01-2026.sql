CREATE TABLE `products`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(8, 2) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `is_featured` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE `categories`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE `product_category`(
    `product_id` BIGINT UNSIGNED NOT NULL,
    `category_id` BIGINT UNSIGNED NOT NULL
);
CREATE TABLE `purchases`(
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `customer_name` VARCHAR(255) NOT NULL,
    `customer_surname` VARCHAR(255) NOT NULL,
    `customer_email` VARCHAR(255) NOT NULL,
    `shipping_address` TEXT NOT NULL,
    `total_amount` DECIMAL(8, 2) NOT NULL,
    `shipping_cost` DECIMAL(8, 2) NOT NULL DEFAULT '0',
    `created_at` TIMESTAMP NOT NULL DEFAULT  CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE `purchase_product`(
    `product_id` BIGINT UNSIGNED NOT NULL,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(8, 2) NOT NULL
);
ALTER TABLE
    `purchase_product` ADD CONSTRAINT `purchase_product_product_id_foreign` FOREIGN KEY(`product_id`) REFERENCES `products`(`id`);
ALTER TABLE
    `product_category` ADD CONSTRAINT `product_category_product_id_foreign` FOREIGN KEY(`product_id`) REFERENCES `products`(`id`);
ALTER TABLE
    `product_category` ADD CONSTRAINT `product_category_category_id_foreign` FOREIGN KEY(`category_id`) REFERENCES `category`(`id`);
ALTER TABLE
    `purchase_product` ADD CONSTRAINT `purchase_product_purchase_id_foreign` FOREIGN KEY(`purchase_id`) REFERENCES `purchases`(`id`);