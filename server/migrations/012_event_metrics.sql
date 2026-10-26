-- Migration 012 — event-specific monitoring metrics.
ALTER TABLE ecotrace_events
  ADD COLUMN monitoring_metrics JSON NULL AFTER event_status;

UPDATE ecotrace_events
SET monitoring_metrics = JSON_ARRAY(
  'GPS Coordinates', 'Status Photo', 'Tree Height (cm)', 'Growth Stage',
  'Diameter Measurement (cm)', 'Survival Status'
)
WHERE monitoring_metrics IS NULL;
