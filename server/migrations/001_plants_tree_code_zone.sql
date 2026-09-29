-- Migration 001 — give ecotrace_plants the two identifiers the UIs require.
--
-- WHY THIS EXISTS
--   The real table (verified via SHOW CREATE TABLE on MariaDB 10.4.32) has no
--   column for the tree tag (`TRE-0892`) and none for the planting zone
--   (`Zone I/II/III`). Every map marker, submission row and zone summary in both
--   apps is keyed on those two values, so without this the 23-tree seed cannot be
--   represented faithfully.
--
--   `tree_code` is nullable so this is safe to apply to a table that already has
--   rows (it is empty today, but the column should not assume that). UNIQUE
--   allows multiple NULLs in MySQL, so existing un-tagged rows do not collide.
--
-- STATUS ENUM WIDENING
--   plant_status becomes ('pending','verified','deceased','incident').
--   Rationale: the admin/Flutter vocabulary is verified|pending|incident|unverified
--   and the database vocabulary is pending|verified|deceased. Only two values
--   overlap. Mapping the 4 `incident` trees to `deceased` would assert that four
--   trees are dead, which the source data does not say — trees.js records a flat
--   `incident` label with no cause. Adding the value preserves the distinction
--   losslessly and gives the deferred dead-tree/EcoTag reconciliation loop a
--   real state to transition out of. `deceased` is left in place for that loop.

ALTER TABLE ecotrace_plants
  ADD COLUMN tree_code VARCHAR(16) NULL COMMENT 'Display tag, e.g. TRE-0892' AFTER plant_id,
  ADD COLUMN zone_name  VARCHAR(48) NULL COMMENT 'Zone I/II/III (admin + Flutter convention)' AFTER tree_code,
  ADD UNIQUE KEY uq_plants_tree_code (tree_code),
  MODIFY COLUMN plant_status ENUM('pending','verified','deceased','incident') NOT NULL DEFAULT 'pending';
