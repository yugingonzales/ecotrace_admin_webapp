-- Migration 016 — notification categories, metadata, and event lifecycle timestamps.
ALTER TABLE ecotrace_alerts
  ADD COLUMN notification_code VARCHAR(48) NULL AFTER alert_id,
  ADD COLUMN metadata JSON NULL AFTER alert_body,
  ADD KEY ix_alerts_notification_code (notification_code);

ALTER TABLE ecotrace_events
  ADD COLUMN start_at DATETIME NULL AFTER start_date,
  ADD COLUMN end_at DATETIME NULL AFTER end_date,
  ADD COLUMN live_at DATETIME NULL AFTER end_at,
  ADD COLUMN concluded_at DATETIME NULL AFTER live_at,
  ADD KEY ix_events_lifecycle (event_status, start_at, end_at);
