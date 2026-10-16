-- Migration 008 — shared event management data for admin and mobile clients.
CREATE TABLE IF NOT EXISTS ecotrace_events (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_title VARCHAR(160) NOT NULL,
  event_description TEXT NULL,
  event_location VARCHAR(255) NULL,
  event_zone VARCHAR(160) NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  trees_per_student INT UNSIGNED NOT NULL DEFAULT 0,
  target_year_batch VARCHAR(32) NULL,
  attendee_count INT UNSIGNED NOT NULL DEFAULT 0,
  event_status ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  KEY ix_events_status_dates (event_status, start_date, end_date),
  KEY ix_events_created_by (created_by),
  CONSTRAINT chk_events_date_range CHECK (end_date >= start_date),
  CONSTRAINT chk_events_trees_positive CHECK (trees_per_student >= 0),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
