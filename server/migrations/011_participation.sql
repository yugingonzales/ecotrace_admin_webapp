-- Migration 011 — authenticated user participation in field events.
CREATE TABLE IF NOT EXISTS ecotrace_event_participation (
  participation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  participation_status ENUM('joined', 'cancelled') NOT NULL DEFAULT 'joined',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  PRIMARY KEY (participation_id),
  UNIQUE KEY uq_event_participation_user_event (event_id, user_id),
  KEY ix_event_participation_user_status (user_id, participation_status),
  CONSTRAINT fk_participation_event FOREIGN KEY (event_id) REFERENCES ecotrace_events (event_id) ON DELETE CASCADE,
  CONSTRAINT fk_participation_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
