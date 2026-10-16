-- Migration 009 — admin-authored alerts delivered to mobile clients.
CREATE TABLE IF NOT EXISTS ecotrace_alerts (
  alert_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alert_title VARCHAR(160) NOT NULL,
  alert_body TEXT NOT NULL,
  alert_label VARCHAR(32) NOT NULL DEFAULT 'INFO',
  alert_type ENUM('info', 'success', 'warning', 'error') NOT NULL DEFAULT 'info',
  alert_status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_id),
  KEY ix_alerts_status_date (alert_status, published_at),
  CONSTRAINT fk_alerts_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
