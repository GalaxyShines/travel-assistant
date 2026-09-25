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
  `name` VARCHAR(120) NOT NULL,
  `color` CHAR(7) NOT NULL DEFAULT '#D97706',
  `order_index` INT NOT NULL DEFAULT 0,
  `version` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_routes_trip_order` (`trip_id`, `order_index`, `id`),
  CONSTRAINT `fk_routes_trip`
    FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `route_stops` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `route_id` INT UNSIGNED NOT NULL,
  `place_id` INT UNSIGNED NOT NULL,
  `stop_index` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_route_stops_position` (`route_id`, `stop_index`),
  INDEX `idx_route_stops_place` (`place_id`),
  CONSTRAINT `fk_route_stops_route`
    FOREIGN KEY (`route_id`) REFERENCES `routes` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_route_stops_place`
    FOREIGN KEY (`place_id`) REFERENCES `places` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `version` VARCHAR(120) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
