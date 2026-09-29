-- Migration 005 — seed two events into ecotrace_events.
--
-- The table already holds one direct-imported row ('Campus Greening 2024'),
-- so this brings the tally to three. Both new events use realistic date ranges
-- that satisfy CHECK chk_date_range (end_date >= start_date) and the
-- tr_validate_event_dates trigger.
--
-- Idempotent without a schema change on purpose: ecotrace_events has no
-- natural unique key to key an ON DUPLICATE KEY UPDATE off, so each insert is
-- guarded by a NOT EXISTS on event_title. Re-running applies nothing.

INSERT INTO ecotrace_events (event_title, event_description, start_date, end_date, trees_per_student, target_year_batch, event_status)
SELECT 'Arbor Day 2025', 'A one-day campus-wide tree planting drive across all three zones', '2025-06-01', '2025-06-30', 3, '2025', 'completed'
WHERE NOT EXISTS (SELECT 1 FROM ecotrace_events WHERE event_title = 'Arbor Day 2025');

INSERT INTO ecotrace_events (event_title, event_description, start_date, end_date, trees_per_student, target_year_batch, event_status)
SELECT 'UEP Catarman Green Drives 2026', 'Spring planting season covering Zones I to III', '2026-03-01', '2026-06-30', 2, '2026', 'active'
WHERE NOT EXISTS (SELECT 1 FROM ecotrace_events WHERE event_title = 'UEP Catarman Green Drives 2026');