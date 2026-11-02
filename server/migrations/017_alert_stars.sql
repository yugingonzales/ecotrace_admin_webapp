-- Migration 017 — unique per-user stars for platform announcements.
CREATE TABLE IF NOT EXISTS ecotrace_alert_stars (
  alert_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_id, user_id),
  CONSTRAINT fk_alert_star_alert FOREIGN KEY (alert_id) REFERENCES ecotrace_alerts (alert_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_star_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
