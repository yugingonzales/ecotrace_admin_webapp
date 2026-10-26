-- Migration 013 — persist the event geofence edited by administrators.
ALTER TABLE ecotrace_events
  ADD COLUMN event_boundary JSON NULL AFTER event_zone;
