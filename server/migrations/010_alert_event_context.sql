-- Migration 010 — optionally associate an admin alert with an event.
ALTER TABLE ecotrace_alerts
  ADD COLUMN event_id BIGINT UNSIGNED NULL AFTER alert_id,
  ADD KEY ix_alerts_event (event_id),
  ADD CONSTRAINT fk_alerts_event FOREIGN KEY (event_id)
    REFERENCES ecotrace_events (event_id) ON DELETE SET NULL;
