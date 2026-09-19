CREATE DATABASE IF NOT EXISTS `travel_helper`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `travel_helper`;

CREATE TABLE IF NOT EXISTS `trips` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `places` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `subtitle` VARCHAR(15) NULL,
  `address` VARCHAR(255) NULL,
  `lng` DECIMAL(11,7) NOT NULL,
  `lat` DECIMAL(10,7) NOT NULL,
  `note` TEXT NULL,
  `visit_time` DATETIME NULL,
  `todo` TEXT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `baidu_uid` VARCHAR(128) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_places_trip_order` (`trip_id`, `order_index`, `id`),
  CONSTRAINT `fk_places_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `routes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `trip_id` INT UNSIGNED NOT NULL,
  `from_place_id` INT UNSIGNED NOT NULL,
  `to_place_id` INT UNSIGNED NOT NULL,
  `travel_mode` ENUM('driving', 'walking', 'transit', 'riding') NOT NULL DEFAULT 'driving',
  `order_index` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_routes_trip_direction` (`trip_id`, `from_place_id`, `to_place_id`),
  INDEX `idx_routes_trip_order` (`trip_id`, `order_index`, `id`),
  INDEX `idx_routes_from_place` (`from_place_id`),
  INDEX `idx_routes_to_place` (`to_place_id`),
  CONSTRAINT `fk_routes_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_routes_from_place`
    FOREIGN KEY (`from_place_id`) REFERENCES `places` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_routes_to_place`
    FOREIGN KEY (`to_place_id`) REFERENCES `places` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
