-- 多路线数据结构迁移脚本（MySQL 5.7+ / 8.x）
--
-- 使用前：
--   1. 完整备份目标数据库并停止后端服务。
--   2. 先执行 USE `实际数据库名`; 再导入本文件。
--   3. 不要使用 mysql 客户端的 --force 参数；任何报错都应立即停止迁移。
--
-- 本脚本可重复执行。旧路线按 order_index、id 合并为一条路线；相邻旧线段
-- 不连续时会自动插入下一段起点作为桥接节点。自环或跨计划地点仍会中止迁移。

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS `migrate_multi_route_v2`$$

CREATE PROCEDURE `migrate_multi_route_v2`()
migration: BEGIN
  DECLARE v_database VARCHAR(64);
  DECLARE v_routes_exists INT DEFAULT 0;
  DECLARE v_route_stops_exists INT DEFAULT 0;
  DECLARE v_legacy_columns INT DEFAULT 0;
  DECLARE v_v2_columns INT DEFAULT 0;
  DECLARE v_data_migration_applied INT DEFAULT 0;
  DECLARE v_final_migration_applied INT DEFAULT 0;
  DECLARE v_existing_stop_count BIGINT DEFAULT 0;
  DECLARE v_bad_trips TEXT DEFAULT NULL;
  DECLARE v_ddl LONGTEXT DEFAULT '';
  DECLARE v_fragment LONGTEXT DEFAULT '';
  DECLARE v_message VARCHAR(128);
  DECLARE v_transaction_started TINYINT DEFAULT 0;
  DECLARE v_cursor_done TINYINT DEFAULT 0;
  DECLARE v_segment_id INT UNSIGNED;
  DECLARE v_segment_trip_id INT UNSIGNED;
  DECLARE v_segment_from_place_id INT UNSIGNED;
  DECLARE v_segment_to_place_id INT UNSIGNED;
  DECLARE v_current_trip_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_current_route_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_last_place_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_stop_index INT UNSIGNED DEFAULT 0;

  DECLARE legacy_route_cursor CURSOR FOR
    SELECT id, trip_id, from_place_id, to_place_id
    FROM `routes`
    ORDER BY trip_id, order_index, id;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_cursor_done = 1;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    IF v_transaction_started = 1 THEN
      ROLLBACK;
    END IF;
    RESIGNAL;
  END;

  SET v_database = DATABASE();
  IF v_database IS NULL OR v_database = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '未选择数据库，请先执行 USE `实际数据库名`;';
  END IF;

  SELECT COUNT(*) INTO v_routes_exists
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes';

  IF v_routes_exists = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '未找到 routes 表，迁移已停止';
  END IF;

  CREATE TABLE IF NOT EXISTS `schema_migrations` (
    `version` VARCHAR(120) NOT NULL,
    `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`version`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  SELECT COUNT(*) INTO v_legacy_columns
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = v_database
    AND TABLE_NAME = 'routes'
    AND COLUMN_NAME IN ('from_place_id', 'to_place_id', 'travel_mode');

  SELECT COUNT(*) INTO v_v2_columns
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = v_database
    AND TABLE_NAME = 'routes'
    AND COLUMN_NAME IN ('name', 'color', 'version');

  SELECT COUNT(*) INTO v_route_stops_exists
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'route_stops';

  SELECT COUNT(*) INTO v_data_migration_applied
  FROM `schema_migrations`
  WHERE `version` = '20260925_multi_stop_routes_data';

  SELECT COUNT(*) INTO v_final_migration_applied
  FROM `schema_migrations`
  WHERE `version` = '20260925_multi_stop_routes';

  IF v_final_migration_applied > 0 THEN
    IF v_legacy_columns > 0 OR v_v2_columns <> 3 OR v_route_stops_exists = 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '迁移标记与实际表结构不一致，请停止操作并检查数据库';
    END IF;
    SELECT '数据库已经完成多路线迁移，无需重复处理' AS migration_status;
    LEAVE migration;
  END IF;

  IF v_legacy_columns = 0 THEN
    IF v_v2_columns <> 3 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = '无法识别 routes 表结构，迁移已停止';
    END IF;

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
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT `fk_route_stops_place`
        FOREIGN KEY (`place_id`) REFERENCES `places` (`id`)
        ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    INSERT INTO `schema_migrations` (`version`) VALUES
      ('20260925_multi_stop_routes_data'),
      ('20260925_multi_stop_routes')
    ON DUPLICATE KEY UPDATE `version` = VALUES(`version`);

    SELECT '当前已是新版表结构，已补写迁移标记' AS migration_status;
    LEAVE migration;
  END IF;

  IF v_legacy_columns <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '旧路线字段不完整，迁移已停止';
  END IF;

  -- 所有旧路线端点都必须存在，并属于路线所在的旅行计划。
  SELECT GROUP_CONCAT(DISTINCT r.trip_id ORDER BY r.trip_id) INTO v_bad_trips
  FROM `routes` r
  LEFT JOIN `places` from_place
    ON from_place.id = r.from_place_id AND from_place.trip_id = r.trip_id
  LEFT JOIN `places` to_place
    ON to_place.id = r.to_place_id AND to_place.trip_id = r.trip_id
  WHERE from_place.id IS NULL OR to_place.id IS NULL;

  IF v_bad_trips IS NOT NULL THEN
    SET v_message = CONCAT('旧路线迁移预检失败：计划地点归属异常：', LEFT(v_bad_trips, 64));
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;

  -- 单条旧线段不得从某地点直接回到同一地点。
  SELECT GROUP_CONCAT(DISTINCT trip_id ORDER BY trip_id) INTO v_bad_trips
  FROM `routes`
  WHERE from_place_id = to_place_id;

  IF v_bad_trips IS NOT NULL THEN
    SET v_message = CONCAT('旧路线迁移预检失败：路线存在相邻重复地点：', LEFT(v_bad_trips, 64));
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;

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
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_route_stops_place`
      FOREIGN KEY (`place_id`) REFERENCES `places` (`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  IF v_data_migration_applied = 0 THEN
    SELECT COUNT(*) INTO v_existing_stop_count FROM `route_stops`;
    IF v_existing_stop_count > 0 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'route_stops 已有数据但缺少迁移标记，迁移已停止';
    END IF;
  END IF;

  -- 允许从“已添加部分新字段”的中断状态继续执行。
  SET v_ddl = '';

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'name'
  ) THEN
    SET v_ddl = 'ADD COLUMN `name` VARCHAR(120) NULL AFTER `trip_id`';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'color'
  ) THEN
    SET v_fragment = 'ADD COLUMN `color` CHAR(7) NULL AFTER `name`';
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'version'
  ) THEN
    SET v_fragment = 'ADD COLUMN `version` INT UNSIGNED NULL DEFAULT 1 AFTER `order_index`';
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  IF v_ddl <> '' THEN
    SET @multi_route_ddl = CONCAT('ALTER TABLE `routes` ', v_ddl);
    PREPARE multi_route_statement FROM @multi_route_ddl;
    EXECUTE multi_route_statement;
    DEALLOCATE PREPARE multi_route_statement;
  END IF;

  IF v_data_migration_applied = 0 THEN
    DROP TEMPORARY TABLE IF EXISTS `_multi_route_heads`;
    DROP TEMPORARY TABLE IF EXISTS `_multi_route_stops`;

    CREATE TEMPORARY TABLE `_multi_route_heads` (
      `trip_id` INT UNSIGNED NOT NULL,
      `route_id` INT UNSIGNED NOT NULL,
      `first_place_id` INT UNSIGNED NOT NULL,
      PRIMARY KEY (`trip_id`),
      UNIQUE KEY (`route_id`)
    ) ENGINE=InnoDB;

    CREATE TEMPORARY TABLE `_multi_route_stops` (
      `route_id` INT UNSIGNED NOT NULL,
      `place_id` INT UNSIGNED NOT NULL,
      `stop_index` INT UNSIGNED NOT NULL,
      PRIMARY KEY (`route_id`, `stop_index`)
    ) ENGINE=InnoDB;

    SET v_cursor_done = 0;
    SET v_current_trip_id = NULL;
    SET v_current_route_id = NULL;
    SET v_last_place_id = NULL;
    SET v_stop_index = 0;

    OPEN legacy_route_cursor;
    route_loop: LOOP
      FETCH legacy_route_cursor INTO
        v_segment_id,
        v_segment_trip_id,
        v_segment_from_place_id,
        v_segment_to_place_id;

      IF v_cursor_done = 1 THEN
        LEAVE route_loop;
      END IF;

      IF v_current_trip_id IS NULL OR v_current_trip_id <> v_segment_trip_id THEN
        SET v_current_trip_id = v_segment_trip_id;
        SET v_current_route_id = v_segment_id;
        SET v_stop_index = 1;
        SET v_last_place_id = v_segment_from_place_id;

        INSERT INTO `_multi_route_heads` (`trip_id`, `route_id`, `first_place_id`)
        VALUES (v_current_trip_id, v_current_route_id, v_segment_from_place_id);

        INSERT INTO `_multi_route_stops` (`route_id`, `place_id`, `stop_index`)
        VALUES (v_current_route_id, v_segment_from_place_id, v_stop_index);
      ELSEIF v_last_place_id <> v_segment_from_place_id THEN
        -- 旧线段断裂：按原排序先补入下一段起点，再保留该段终点。
        SET v_stop_index = v_stop_index + 1;
        SET v_last_place_id = v_segment_from_place_id;
        INSERT INTO `_multi_route_stops` (`route_id`, `place_id`, `stop_index`)
        VALUES (v_current_route_id, v_segment_from_place_id, v_stop_index);
      END IF;

      SET v_stop_index = v_stop_index + 1;
      SET v_last_place_id = v_segment_to_place_id;
      INSERT INTO `_multi_route_stops` (`route_id`, `place_id`, `stop_index`)
      VALUES (v_current_route_id, v_segment_to_place_id, v_stop_index);
    END LOOP;
    CLOSE legacy_route_cursor;

    START TRANSACTION;
    SET v_transaction_started = 1;

    UPDATE `routes` route_row
    INNER JOIN `_multi_route_heads` route_head ON route_head.route_id = route_row.id
    SET route_row.name = '计划路线',
        route_row.color = '#D97706',
        route_row.version = 1;

    INSERT INTO `route_stops` (`route_id`, `place_id`, `stop_index`)
    SELECT route_id, place_id, stop_index
    FROM `_multi_route_stops`
    ORDER BY route_id, stop_index;

    DELETE route_row
    FROM `routes` route_row
    LEFT JOIN `_multi_route_heads` route_head ON route_head.route_id = route_row.id
    WHERE route_head.route_id IS NULL;

    INSERT INTO `schema_migrations` (`version`)
    VALUES ('20260925_multi_stop_routes_data')
    ON DUPLICATE KEY UPDATE `version` = VALUES(`version`);

    COMMIT;
    SET v_transaction_started = 0;
  END IF;

  -- 删除旧外键、索引和字段，并一次性收紧新版字段约束。
  SET v_ddl = '';

  SELECT GROUP_CONCAT(
    DISTINCT CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    ORDER BY CONSTRAINT_NAME SEPARATOR ', '
  ) INTO v_fragment
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = v_database
    AND TABLE_NAME = 'routes'
    AND COLUMN_NAME IN ('from_place_id', 'to_place_id')
    AND REFERENCED_TABLE_NAME IS NOT NULL;

  IF v_fragment IS NOT NULL AND v_fragment <> '' THEN
    SET v_ddl = v_fragment;
  END IF;

  SELECT GROUP_CONCAT(
    DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`')
    ORDER BY INDEX_NAME SEPARATOR ', '
  ) INTO v_fragment
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = v_database
    AND TABLE_NAME = 'routes'
    AND INDEX_NAME IN ('uq_routes_trip_direction', 'idx_routes_from_place', 'idx_routes_to_place');

  IF v_fragment IS NOT NULL AND v_fragment <> '' THEN
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'from_place_id'
  ) THEN
    SET v_fragment = 'DROP COLUMN `from_place_id`';
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'to_place_id'
  ) THEN
    SET v_fragment = 'DROP COLUMN `to_place_id`';
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = v_database AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'travel_mode'
  ) THEN
    SET v_fragment = 'DROP COLUMN `travel_mode`';
    SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));
  END IF;

  SET v_fragment = CONCAT(
    'MODIFY COLUMN `name` VARCHAR(120) NOT NULL, ',
    'MODIFY COLUMN `color` CHAR(7) NOT NULL DEFAULT ''#D97706'', ',
    'MODIFY COLUMN `version` INT UNSIGNED NOT NULL DEFAULT 1'
  );
  SET v_ddl = IF(v_ddl = '', v_fragment, CONCAT(v_ddl, ', ', v_fragment));

  SET @multi_route_ddl = CONCAT('ALTER TABLE `routes` ', v_ddl);
  PREPARE multi_route_statement FROM @multi_route_ddl;
  EXECUTE multi_route_statement;
  DEALLOCATE PREPARE multi_route_statement;

  INSERT INTO `schema_migrations` (`version`)
  VALUES ('20260925_multi_stop_routes')
  ON DUPLICATE KEY UPDATE `version` = VALUES(`version`);

  DROP TEMPORARY TABLE IF EXISTS `_multi_route_stops`;
  DROP TEMPORARY TABLE IF EXISTS `_multi_route_heads`;

  SELECT '多路线数据库迁移完成' AS migration_status;
END$$

CALL `migrate_multi_route_v2`()$$
DROP PROCEDURE `migrate_multi_route_v2`$$

DELIMITER ;

-- 最终核对：应看到 name/color/version，不应再看到旧的三个路线字段。
SHOW COLUMNS FROM `routes`;

SELECT `version`, `applied_at`
FROM `schema_migrations`
WHERE `version` IN (
  '20260925_multi_stop_routes_data',
  '20260925_multi_stop_routes'
)
ORDER BY `version`;

SELECT
  (SELECT COUNT(*) FROM `routes`) AS route_count,
  (SELECT COUNT(*) FROM `route_stops`) AS route_stop_count;
