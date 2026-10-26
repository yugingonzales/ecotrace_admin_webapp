-- Migration 015 — normalized submission workflow.
--
-- A submission is the workflow aggregate. Measurements, incidents, evidence,
-- and audit records are separate relations so each fact has one owner and can
-- evolve independently without duplicating user, event, or plant attributes.

-- The existing API already treats this as the canonical tree relation, but the
-- live database did not contain it. Keep tree identity here rather than copying
-- coordinates/species into every submission.
CREATE TABLE IF NOT EXISTS ecotrace_plants (
  tree_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tree_code VARCHAR(80) NOT NULL,
  tree_name VARCHAR(160) NULL,
  zone_name VARCHAR(160) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  tree_planter_name VARCHAR(160) NULL,
  tree_planted_date DATE NULL,
  tree_status ENUM('pending', 'verified', 'deceased', 'incident', 'unverified') NOT NULL DEFAULT 'unverified',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tree_id),
  UNIQUE KEY uq_plants_tree_code (tree_code),
  KEY ix_plants_status (tree_status),
  KEY ix_plants_coordinates (latitude, longitude),
  CONSTRAINT chk_plants_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_plants_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecotrace_submissions (
  submission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tree_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NULL,
  submitted_by BIGINT UNSIGNED NOT NULL,
  submission_type ENUM('verification', 'incident') NOT NULL,
  submission_status ENUM('pending', 'approved', 'declined', 'resubmit') NOT NULL DEFAULT 'pending',
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  decline_reason VARCHAR(160) NULL,
  reviewer_note VARCHAR(2000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (submission_id),
  KEY ix_submissions_status_date (submission_status, submitted_at),
  KEY ix_submissions_tree_status (tree_id, submission_status),
  KEY ix_submissions_submitter (submitted_by, submitted_at),
  KEY ix_submissions_event (event_id),
  CONSTRAINT fk_submissions_tree FOREIGN KEY (tree_id) REFERENCES ecotrace_plants (tree_id),
  CONSTRAINT fk_submissions_event FOREIGN KEY (event_id) REFERENCES ecotrace_events (event_id) ON DELETE SET NULL,
  CONSTRAINT fk_submissions_submitter FOREIGN KEY (submitted_by) REFERENCES users (id),
  CONSTRAINT fk_submissions_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecotrace_submission_verifications (
  submission_id BIGINT UNSIGNED NOT NULL,
  health_status ENUM('healthy', 'stressed', 'damaged', 'deceased') NULL,
  plant_stage ENUM('seed', 'seedling', 'sapling', 'young_tree', 'mature_tree') NULL,
  tree_height_cm DECIMAL(8,2) NULL,
  trunk_diameter_cm DECIMAL(8,2) NULL,
  leaf_condition ENUM('excellent', 'good', 'fair', 'poor') NULL,
  soil_condition ENUM('excellent', 'good', 'fair', 'poor') NULL,
  weather_condition ENUM('excellent', 'good', 'fair', 'poor') NULL,
  temperature_celsius DECIMAL(5,2) NULL,
  latitude DECIMAL(10,8) NULL,
  longitude DECIMAL(11,8) NULL,
  notes VARCHAR(2000) NULL,
  PRIMARY KEY (submission_id),
  CONSTRAINT fk_submission_verification_submission FOREIGN KEY (submission_id) REFERENCES ecotrace_submissions (submission_id) ON DELETE CASCADE,
  CONSTRAINT chk_submission_verification_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_submission_verification_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_submission_verification_measurements CHECK (tree_height_cm IS NULL OR tree_height_cm >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecotrace_submission_incidents (
  submission_id BIGINT UNSIGNED NOT NULL,
  incident_type VARCHAR(120) NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  description VARCHAR(2000) NULL,
  PRIMARY KEY (submission_id),
  CONSTRAINT fk_submission_incident_submission FOREIGN KEY (submission_id) REFERENCES ecotrace_submissions (submission_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecotrace_submission_evidence (
  evidence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id BIGINT UNSIGNED NOT NULL,
  evidence_type ENUM('photo', 'document', 'other') NOT NULL DEFAULT 'photo',
  storage_key VARCHAR(512) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(100) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  captured_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (evidence_id),
  KEY ix_submission_evidence_submission (submission_id, evidence_id),
  CONSTRAINT fk_submission_evidence_submission FOREIGN KEY (submission_id) REFERENCES ecotrace_submissions (submission_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ecotrace_audit_logs (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action_code VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  KEY ix_audit_occurred (occurred_at, audit_id),
  KEY ix_audit_entity (entity_type, entity_id, occurred_at),
  KEY ix_audit_actor (actor_user_id, occurred_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
