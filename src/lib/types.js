/**
 * Database types for the `ecotrace_db` MariaDB schema.
 *
 * Every field name, ENUM member and constraint below was decoded directly from
 * the InnoDB table definitions in `C:\xampp\mysql\data\ecotrace_db\*.frm` — these
 * are NOT invented. Keep this file in lockstep with the database.
 *
 * Conventions:
 *  - Primary keys are `*_id` and auto-increment, except `ecotrace_event_tasks`,
 *    which uses a composite key.
 *  - `DATE`/`DATETIME` columns arrive as strings; `BOOLEAN` (TINYINT(1)) as 0|1.
 *  - Nullable columns are typed `| null` because MariaDB returns them that way.
 *
 * See INTEGRATION_PROGRESS_LOG.md for the route mapping and for the list of
 * tables that still need to be created (staff, incidents, audit log, event
 * boundaries).
 */

// ── ENUM unions ─────────────────────────────────────────────────────────────

/**
 * `ecotrace_plants.plant_status`
 *
 * This is the WORKFLOW axis (has this tree been checked, and what happened?),
 * not a health assessment — see `HealthStatus` below. The two are orthogonal and
 * the schema currently squashes them into one column, which is why
 * "unverified but healthy" and "verified and dead" are both unrepresentable.
 *
 * `'incident'` and `'unverified'` were added by migrations 001 and 002 to carry
 * the admin's four fixture statuses exactly. Collapsing either onto a neighbouring
 * value is lossy in a visible way — MapView colours and counts each status
 * separately, so a merge would silently redraw pins under the wrong legend entry.
 * @typedef {'pending' | 'verified' | 'deceased' | 'incident' | 'unverified'} PlantStatus
 */

/**
 * `ecotrace_plant_verifications.health_status`
 * @typedef {'healthy' | 'stressed' | 'damaged' | 'deceased'} HealthStatus
 */

/**
 * `ecotrace_plant_verifications.plant_stage`
 * @typedef {'seed' | 'seedling' | 'sapling' | 'young_tree' | 'mature_tree'} PlantStage
 */

/**
 * Shared condition scale used by `leaf_condition`, `soil_condition` and
 * `weather_condition`.
 * @typedef {'excellent' | 'good' | 'fair' | 'poor'} ConditionRating
 */

/**
 * `ecotrace_events.event_status`
 * @typedef {'draft' | 'active' | 'completed' | 'cancelled'} EventStatus
 */

/**
 * `ecotrace_event_tasks.task_status`
 * @typedef {'assigned' | 'in_progress' | 'completed' | 'cancelled'} TaskStatus
 */

/**
 * `ecotrace_verification_photos.photo_type`
 * @typedef {'overview' | 'leaves' | 'trunk' | 'roots' | 'damage' | 'other'} PhotoType
 */

// ── Tables ──────────────────────────────────────────────────────────────────

/**
 * `ecotrace_students` — PK `student_id`, UNIQUE `email`.
 * @typedef {object} Student
 * @property {number} student_id
 * @property {string} full_name
 * @property {string} email
 * @property {string} password_hash bcrypt hash. Never exposed by the API.
 * @property {string} year_batch
 * @property {0 | 1} is_active
 * @property {0 | 1} email_verified
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string | null} last_login_at
 */

/**
 * `Student` as returned by the API — credentials stripped by the server.
 * @typedef {Omit<import('./types.js').Student, 'password_hash'>} StudentPublic
 */

/**
 * `ecotrace_plants` — PK `plant_id`.
 * CHECK `chk_latitude` (-90..90), `chk_longitude` (-180..180).
 * Indexed by `idx_coordinates` (latitude, longitude), status and planted_date.
 * @typedef {object} Plant
 * @property {number} plant_id
 * @property {string | null} tree_code Display tag, e.g. `'TRE-0892'`. Added by
 *   migration 001 — this is the identifier both UIs key on, and it was previously
 *   unrepresentable. Nullable: rows created before the migration have no tag, and
 *   an EcoTag import would backfill it later.
 * @property {string | null} zone_name `'Zone I' | 'Zone II' | 'Zone III'`. Also
 *   added by migration 001.
 * @property {number} latitude
 * @property {number} longitude
 * @property {string | null} location_address
 * @property {string} planted_date `DATE` as `YYYY-MM-DD`.
 * @property {string} plant_species
 * @property {PlantStatus} plant_status
 * @property {number} verification_count
 * @property {string | null} last_verified_at
 * @property {number | null} created_by FK-shaped reference to
 *   `ecotrace_students.student_id`.
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Payload for `POST /api/plants`.
 * @typedef {object} PlantInput
 * @property {number} latitude
 * @property {number} longitude
 * @property {string | null} [location_address]
 * @property {string} planted_date
 * @property {string} plant_species
 * @property {number | null} [created_by]
 */

/**
 * `ecotrace_events` — PK `event_id`.
 * CHECK `chk_date_range` (end_date >= start_date), `chk_trees_positive`.
 * NOTE: there is no target-tree column; the dashboard total is derived from
 * `trees_per_student * target_year_batch`. See the log's open questions.
 * @typedef {object} EcoEvent
 * @property {number} event_id
 * @property {string} event_title
 * @property {string | null} event_description
 * @property {string} start_date `DATE` as `YYYY-MM-DD`.
 * @property {string} end_date
 * @property {number} trees_per_student
 * @property {string} target_year_batch Year batch this event targets, e.g. `'2026'`.
 * @property {EventStatus} event_status
 * @property {number | null} created_by
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Payload for `POST /api/events`.
 * @typedef {object} EventInput
 * @property {string} event_title
 * @property {string | null} [event_description]
 * @property {string} start_date
 * @property {string} end_date
 * @property {number} trees_per_student
 * @property {string} target_year_batch
 */


/**
 * `ecotrace_event_tasks` — composite key `(event_id, plant_id, student_id)`
 * (`zf0`), plus the `task_id` primary key. UNIQUE `unique_event_plant_student`.
 * @typedef {object} EventTask
 * @property {number} task_id
 * @property {number} event_id
 * @property {number} plant_id
 * @property {number} student_id
 * @property {TaskStatus} task_status
 * @property {string} assigned_at
 * @property {string | null} completed_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * `ecotrace_plant_verifications` — PK `verification_id`.
 * The admin portal's "Submissions" module is a view over this table: a
 * `verification` submission is a row here, while an `incident` submission is
 * expected to be `health_status = 'deceased'` or `'damaged'`. Note this mapping
 * is provisional until the `incidents` table exists.
 * CHECK `chk_height_positive`, `chk_circumference_positive`, `chk_canopy_positive`.
 * @typedef {object} PlantVerification
 * @property {number} verification_id
 * @property {number} plant_id
 * @property {number} student_id
 * @property {number | null} event_id
 * @property {HealthStatus} health_status
 * @property {PlantStage} plant_stage
 * @property {number | null} height_cm
 * @property {number | null} circumference_cm
 * @property {number | null} canopy_diameter_cm
 * @property {ConditionRating | null} leaf_condition
 * @property {ConditionRating | null} soil_condition
 * @property {0 | 1} has_pests
 * @property {0 | 1} has_disease
 * @property {0 | 1} needs_water
 * @property {0 | 1} needs_fertilizer
 * @property {string | null} verification_notes
 * @property {ConditionRating | null} weather_condition
 * @property {number | null} temperature_celsius
 * @property {string} verified_at `DATETIME` as `YYYY-MM-DD HH:MM:SS`.
 */

/**
 * Payload for `POST /api/verifications`.
 * @typedef {object} VerificationInput
 * @property {number} plant_id
 * @property {number} student_id
 * @property {number | null} [event_id]
 * @property {HealthStatus} health_status
 * @property {PlantStage} plant_stage
 * @property {number | null} [height_cm]
 * @property {number | null} [circumference_cm]
 * @property {number | null} [canopy_diameter_cm]
 * @property {ConditionRating | null} [leaf_condition]
 * @property {ConditionRating | null} [soil_condition]
 * @property {0 | 1} [has_pests]
 * @property {0 | 1} [has_disease]
 * @property {0 | 1} [needs_water]
 * @property {0 | 1} [needs_fertilizer]
 * @property {string | null} [verification_notes]
 * @property {ConditionRating | null} [weather_condition]
 * @property {number | null} [temperature_celsius]
 */

// ── Views ───────────────────────────────────────────────────────────────────

/**
 * `vw_active_plants`
 * @typedef {object} ActivePlantView
 * @property {number} plant_id
 * @property {string} plant_species
 * @property {number} latitude
 * @property {number} longitude
 * @property {PlantStatus} plant_status
 * @property {string} planted_date
 * @property {string | null} last_verified_at
 */

/**
 * `vw_event_progress`
 * @typedef {object} EventProgressView
 * @property {number} event_id
 * @property {string} event_title
 * @property {string} start_date
 * @property {string} end_date
 * @property {EventStatus} event_status
 * @property {string} target_year_batch
 * @property {number} trees_per_student
 * @property {number} plants_assigned
 * @property {number} plants_completed
 * @property {number} completion_rate
 */

/**
 * `vw_student_progress`
 * @typedef {object} StudentProgressView
 * @property {number} student_id
 * @property {string} full_name
 * @property {string} year_batch
 * @property {number} tasks_assigned
 * @property {number} tasks_completed
 * @property {number} plants_verified
 */

// ── Session / auth ──────────────────────────────────────────────────────────

/**
 * `POST /api/auth/login` response body.
 * @typedef {object} AuthSession
 * @property {string} token
 * @property {StudentPublic} user
 */

/**
 * `GET /api/overview` response — backs the Command Overview stat cards.
 * @typedef {object} OverviewStats
 * @property {number} totalTreesVerified
 * @property {number} totalTreesTarget
 * @property {number} activeStaff
 * @property {number} pendingSubmissions
 * @property {number} incidentReports
 * @property {number} highPriorityIncidents
 */

/**
 * Shared envelope for list endpoints.
 * @template T
 * @typedef {object} Paginated
 * @property {T[]} items
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 */

/**
 * `ecotrace_verification_photos` — PK `photo_id`, FK `verification_id`.
 * @typedef {object} VerificationPhoto
 * @property {number} photo_id
 * @property {number} verification_id
 * @property {string} photo_url
 * @property {PhotoType} photo_type
 * @property {number | null} file_size_bytes
 * @property {string | null} mime_type
 * @property {string} uploaded_at
 */

/**
 * `ecotrace_plant_reservations` — PK `reservation_id`.
 * @typedef {object} PlantReservation
 * @property {number} reservation_id
 * @property {number} plant_id
 * @property {number} student_id
 * @property {number | null} event_id
 * @property {string} reserved_at
 * @property {string} expires_at
 * @property {0 | 1} is_active
 * @property {string | null} released_at
 */
