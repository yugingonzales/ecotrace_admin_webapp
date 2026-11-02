-- Migration 018 — one-time closing-soon lifecycle alert guard.
ALTER TABLE ecotrace_events
  ADD COLUMN closing_at DATETIME NULL AFTER live_at,
  ADD KEY ix_events_closing (event_status, end_at, closing_at);
