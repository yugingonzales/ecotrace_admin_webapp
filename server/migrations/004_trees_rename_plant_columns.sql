-- Migration 004 — rename the four plant_* attributes to tree_* and add the two
-- missing tree attributes.
--
-- WHY
--   The requested tree vocabulary is tree_id, tree_name ... Those four columns
--   on ecotrace_plants still carried the old plant_* names, so the schema and
--   the request no longer agree. This file performs the rename against the live
--   MariaDB 10.4.32 table, whose exact types were verified by SHOW CREATE TABLE
--   before writing a single statement.
--
-- WHAT MOVES
--   ecotrace_plants:  plant_id       -> tree_id            (PK, AUTO_INCREMENT)
--                     plant_species  -> tree_name          (species common name)
--                     planted_date   -> tree_planted_date
--                     plant_status   -> tree_status
--
--   Plus the three foreign-key columns that pointed at the old key, so the
--   schema keeps one coherent identifier everywhere, and the index/constraint
--   names that spelled out 'plant':
--     ecotrace_event_tasks.plant_id          -> tree_id
--     ecotrace_plant_verifications.plant_id  -> tree_id
--     ecotrace_plant_reservations.plant_id   -> tree_id
--     idx_plant_status      -> idx_tree_status
--     idx_planted_date      -> idx_tree_planted_date
--     idx_plant_tasks       -> idx_tree_tasks
--     unique_event_plant_student -> unique_event_tree_student
--     idx_plant_verifications  -> idx_tree_verifications
--     idx_plant_reservations   -> idx_tree_reservations
--
--   Unchanged on purpose: latitude and longitude stay separate columns (the
--   requested coordinate split already exists), and the table name itself is
--   still ecotrace_plants — only the requested attribute names change.
--
-- WHAT IS NEW
--   tree_planter_name  VARCHAR(120)  Name of the person who planted the tree.
--                                    A real column at last — the dev seed used
--                                    to park those names in location_address
--                                    (migration 006 moves them out).
--   tree_description   TEXT          Free-form description of the tree, if any.
--
-- WHY THE FKs AND VIEWS ARE DROPPED AND REBUILT
--   MariaDB 10.4 refuses to rename a column that a FOREIGN KEY still
--   references (ER_FK_COLUMN_CANNOT_CHANGE). The three FKs are dropped first
--   and recreated with identical names and ON DELETE behaviour against the new
--   tree_id. vw_active_plants and vw_student_progress hard-reference plant_*
--   columns in their bodies, so they are dropped at the top and recreated at
--   the bottom with the same result shape under the new names.
--
-- WHY THE LONG CHANGE COLUMN FORM
--   MariaDB 10.4 has no RENAME COLUMN (added in 10.5.2), so every rename must
--   restate the column's full definition. The types below are copied verbatim
--   from SHOW CREATE TABLE — guessing them here would silently change types.
--
-- RELATED FILES
--   server/scripts/generate-seed.mjs and server/migrations/003_seed_plants.sql
--   intentionally still speak plant_* : 003 is the pre-rename seed and must run
--   before this file on a fresh database. Do not regenerate 003 to the new
--   names; the ordering would then break.

-- Drop the three FKs that reference ecotrace_plants(plant_id). Recreated below.
ALTER TABLE ecotrace_event_tasks DROP FOREIGN KEY ecotrace_event_tasks_ibfk_2;
ALTER TABLE ecotrace_plant_verifications DROP FOREIGN KEY ecotrace_plant_verifications_ibfk_1;
ALTER TABLE ecotrace_plant_reservations DROP FOREIGN KEY ecotrace_plant_reservations_ibfk_1;

-- Drop the two views that reference the plant_* columns; recreated at the end.
DROP VIEW IF EXISTS vw_active_plants;
DROP VIEW IF EXISTS vw_student_progress;

-- Rename the FK column in each dependent table (type restated exactly).
ALTER TABLE ecotrace_event_tasks
  CHANGE COLUMN plant_id tree_id INT(10) UNSIGNED NOT NULL;
ALTER TABLE ecotrace_plant_verifications
  CHANGE COLUMN plant_id tree_id INT(10) UNSIGNED NOT NULL;
ALTER TABLE ecotrace_plant_reservations
  CHANGE COLUMN plant_id tree_id INT(10) UNSIGNED NOT NULL;

-- Rename the 'plant' index and unique-key names on those tables.
ALTER TABLE ecotrace_event_tasks
  DROP INDEX idx_plant_tasks,
  ADD INDEX idx_tree_tasks (tree_id),
  DROP INDEX unique_event_plant_student,
  ADD UNIQUE KEY unique_event_tree_student (event_id, tree_id, student_id);
ALTER TABLE ecotrace_plant_verifications
  DROP INDEX idx_plant_verifications,
  ADD INDEX idx_tree_verifications (tree_id);
ALTER TABLE ecotrace_plant_reservations
  DROP INDEX idx_plant_reservations,
  ADD INDEX idx_tree_reservations (tree_id);

-- The main rename on ecotrace_plants, plus the two new attributes.
ALTER TABLE ecotrace_plants
  CHANGE COLUMN plant_id tree_id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  CHANGE COLUMN planted_date tree_planted_date DATE DEFAULT NULL,
  CHANGE COLUMN plant_species tree_name VARCHAR(255) DEFAULT NULL,
  CHANGE COLUMN plant_status tree_status ENUM('pending','verified','deceased','incident','unverified') NOT NULL DEFAULT 'pending',
  ADD COLUMN tree_planter_name VARCHAR(120) DEFAULT NULL COMMENT 'Name of the person who planted the tree.' AFTER location_address,
  ADD COLUMN tree_description TEXT DEFAULT NULL COMMENT 'Free-form description of the tree, if any.' AFTER tree_planter_name;

-- Rename the two status/date indexes on the renamed columns (separate ALTER so
-- the new column names are unambiguous when the indexes are created).
ALTER TABLE ecotrace_plants
  DROP INDEX idx_plant_status,
  ADD INDEX idx_tree_status (tree_status),
  DROP INDEX idx_planted_date,
  ADD INDEX idx_tree_planted_date (tree_planted_date);

-- Recreate the three FKs against the new key, with the original behaviour.
ALTER TABLE ecotrace_event_tasks
  ADD CONSTRAINT ecotrace_event_tasks_ibfk_2
  FOREIGN KEY (tree_id) REFERENCES ecotrace_plants (tree_id) ON DELETE CASCADE;
ALTER TABLE ecotrace_plant_verifications
  ADD CONSTRAINT ecotrace_plant_verifications_ibfk_1
  FOREIGN KEY (tree_id) REFERENCES ecotrace_plants (tree_id) ON DELETE CASCADE;
ALTER TABLE ecotrace_plant_reservations
  ADD CONSTRAINT ecotrace_plant_reservations_ibfk_1
  FOREIGN KEY (tree_id) REFERENCES ecotrace_plants (tree_id) ON DELETE CASCADE;

-- Recreate vw_active_plants: same joins, same output shape, renamed columns.
CREATE VIEW vw_active_plants AS
SELECT p.tree_id AS tree_id,
       p.latitude AS latitude,
       p.longitude AS longitude,
       p.location_address AS location_address,
       p.tree_planted_date AS tree_planted_date,
       p.tree_name AS tree_name,
       p.verification_count AS verification_count,
       p.last_verified_at AS last_verified_at,
       pv.health_status AS last_health_status,
       pv.plant_stage AS last_plant_stage,
       pv.height_cm AS last_height_cm
FROM ecotrace_plants p
LEFT JOIN ecotrace_plant_verifications pv
  ON pv.verification_id = (
    SELECT verification_id
    FROM ecotrace_plant_verifications
    WHERE tree_id = p.tree_id
    ORDER BY verified_at DESC
    LIMIT 1)
WHERE p.tree_status = 'verified' AND p.tree_status <> 'deceased';

-- Recreate vw_student_progress: the only plant_ reference was
-- count(distinct pv.plant_id), now count(distinct pv.tree_id).
CREATE VIEW vw_student_progress AS
SELECT s.student_id AS student_id,
       s.full_name AS full_name,
       s.email AS email,
       s.year_batch AS year_batch,
       count(distinct pv.verification_id) AS total_verifications,
       count(distinct pv.tree_id) AS unique_plants_verified,
       count(distinct pv.event_id) AS events_participated,
       max(pv.verified_at) AS last_verification_date
FROM ecotrace_students s
LEFT JOIN ecotrace_plant_verifications pv
  ON pv.student_id = s.student_id
WHERE s.is_active = 1
GROUP BY s.student_id, s.full_name, s.email, s.year_batch;