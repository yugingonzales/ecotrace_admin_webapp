-- Migration 002 — preserve the `unverified` status, which migration 001 collapsed.
--
-- WHY
--   Migration 001 added `incident` and the seed mapped `unverified` onto
--   `pending` as the nearest available value. That mapping is lossy in a way the
--   admin UI can see: MapView renders `pending` as an orange pin ("Pending
--   Verification") and `unverified` as a grey one ("Unverified / Missing"), and
--   it shows a separate count for each. With the collapse the map would draw 8
--   orange pins where the fixture has 6 orange + 2 grey, and the "Unverified"
--   layer filter would count 0 while still being shown in the legend.
--
--   `unverified` is also not the same claim as `pending` in this dataset: it is
--   the label used for a tree the field team flagged as unaccounted-for, which
--   is why the UI groups it with "Missing". Collapsing it into the ordinary
--   verification backlog would quietly reclassify those trees as routine.
--
--   So the column now represents the admin's four statuses exactly, and the
--   seed mapping is 1:1 with no approximation.
--
--   This is the same additive ENUM widening as 001 and carries the same caveat:
--   `plant_status` remains a single column doing the work of a workflow axis.
--   The health axis is still unrepresented here; see INTEGRATION_PROGRESS_LOG.md
--   for the proposed split. `deceased` is retained for the deferred dead-tree
--   reconciliation loop, which is what will transition `incident` and
--   `unverified` rows once EcoTag import gives a cause.

ALTER TABLE ecotrace_plants
  MODIFY COLUMN plant_status
    ENUM('pending','verified','deceased','incident','unverified') NOT NULL DEFAULT 'pending';
