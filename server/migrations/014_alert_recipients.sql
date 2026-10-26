-- Migration 014 — per-user alert delivery and read state.
CREATE TABLE IF NOT EXISTS ecotrace_alert_recipients (
  recipient_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alert_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipient_id),
  UNIQUE KEY uq_alert_recipient (alert_id, user_id),
  KEY ix_alert_recipient_user_read (user_id, read_at),
  CONSTRAINT fk_alert_recipient_alert FOREIGN KEY (alert_id) REFERENCES ecotrace_alerts (alert_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_recipient_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
