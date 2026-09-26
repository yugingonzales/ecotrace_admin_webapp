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
 */
export type PlantStatus = 'pending' | 'verified' | 'deceased' | 'incident' | 'unverified'

/** `ecotrace_plant_verifications.health_status` */
export type HealthStatus = 'healthy' | 'stressed' | 'damaged' | 'deceased'

/** `ecotrace_plant_verifications.plant_stage` */
export type PlantStage = 'seed' | 'seedling' | 'sapling' | 'young_tree' | 'mature_tree'

/** Shared condition scale used by `leaf_condition`, `soil_condition` and `weather_condition`. */
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor'

/** `ecotrace_events.event_status` */
export type EventStatus = 'draft' | 'active' | 'completed' | 'cancelled'

/** `ecotrace_event_tasks.task_status` */
export type TaskStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'

/** `ecotrace_verification_photos.photo_type` */
export type PhotoType = 'overview' | 'leaves' | 'trunk' | 'roots' | 'damage' | 'other'

// ── Tables ──────────────────────────────────────────────────────────────────

/** `ecotrace_students` — PK `student_id`, UNIQUE `email`. */
export interface Student {
  student_id: number
  full_name: string
  email: string
  /** bcrypt hash. Never exposed by the API. */
  password_hash: string
  year_batch: string
  is_active: 0 | 1
  email_verified: 0 | 1
  created_at: string
  updated_at: string
  last_login_at: string | null
}

/** `Student` as returned by the API — credentials stripped by the server. */
export type StudentPublic = Omit<Student, 'password_hash'>

/**
 * `ecotrace_plants` — PK `plant_id`.
 * CHECK `chk_latitude` (-90..90), `chk_longitude` (-180..180).
 * Indexed by `idx_coordinates` (latitude, longitude), status and planted_date.
 */
export interface Plant {
  plant_id: number
  /**
   * Display tag, e.g. `'TRE-0892'`. Added by migration 001 — this is the
   * identifier both UIs key on, and it was previously unrepresentable.
   * Nullable: rows created before the migration have no tag, and an EcoTag
   * import would backfill it later.
   */
  tree_code: string | null
  /** `'Zone I' | 'Zone II' | 'Zone III'`. Also added by migration 001. */
  zone_name: string | null
  latitude: number
  longitude: number
  location_address: string | null
  /** `DATE` as `YYYY-MM-DD`. */
  planted_date: string
  plant_species: string
  plant_status: PlantStatus
  verification_count: number
  last_verified_at: string | null
  /** FK-shaped reference to `ecotrace_students.student_id`. */
  created_by: number | null
  created_at: string
  updated_at: string
}

/** Payload for `POST /api/plants`. */
export interface PlantInput {
  latitude: number
  longitude: number
  location_address?: string | null
  planted_date: string
  plant_species: string
  created_by?: number | null
}

/**
 * `ecotrace_events` — PK `event_id`.
 * CHECK `chk_date_range` (end_date >= start_date), `chk_trees_positive`.
 * NOTE: there is no target-tree column; the dashboard total is derived from
 * `trees_per_student * target_year_batch`. See the log's open questions.
 */
export interface EcoEvent {
  event_id: number
  event_title: string
  event_description: string | null
  /** `DATE` as `YYYY-MM-DD`. */
  start_date: string
  end_date: string
  trees_per_student: number
  /** Year batch this event targets, e.g. `'2026'`. */
  target_year_batch: string
  event_status: EventStatus
  created_by: number | null
  created_at: string
  updated_at: string
}

/** Payload for `POST /api/events`. */
export interface EventInput {
  event_title: string
  event_description?: string | null
  start_date: string
  end_date: string
  trees_per_student: number
  target_year_batch: string
}


/**
 * `ecotrace_event_tasks` — composite key `(event_id, plant_id, student_id)`
 * (`zf0`), plus the `task_id` primary key. UNIQUE `unique_event_plant_student`.
 */
export interface EventTask {
  task_id: number
  event_id: number
  plant_id: number
  student_id: number
  task_status: TaskStatus
  assigned_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * `ecotrace_plant_verifications` — PK `verification_id`.
 * The admin portal's "Submissions" module is a view over this table: a
 * `verification` submission is a row here, while an `incident` submission is
 * expected to be `health_status = 'deceased'` or `'damaged'`. Note this mapping
 * is provisional until the `incidents` table exists.
 * CHECK `chk_height_positive`, `chk_circumference_positive`, `chk_canopy_positive`.
 */
export interface PlantVerification {
  verification_id: number
  plant_id: number
  student_id: number
  event_id: number | null
  health_status: HealthStatus
  plant_stage: PlantStage
  height_cm: number | null
  circumference_cm: number | null
  canopy_diameter_cm: number | null
  leaf_condition: ConditionRating | null
  soil_condition: ConditionRating | null
  has_pests: 0 | 1
  has_disease: 0 | 1
  needs_water: 0 | 1
  needs_fertilizer: 0 | 1
  verification_notes: string | null
  weather_condition: ConditionRating | null
  temperature_celsius: number | null
  /** `DATETIME` as `YYYY-MM-DD HH:MM:SS`. */
  verified_at: string
}

/** Payload for `POST /api/verifications`. */
export interface VerificationInput {
  plant_id: number
  student_id: number
  event_id?: number | null
  health_status: HealthStatus
  plant_stage: PlantStage
  height_cm?: number | null
  circumference_cm?: number | null
  canopy_diameter_cm?: number | null
  leaf_condition?: ConditionRating | null
  soil_condition?: ConditionRating | null
  has_pests?: 0 | 1
  has_disease?: 0 | 1
  needs_water?: 0 | 1
  needs_fertilizer?: 0 | 1
  verification_notes?: string | null
  weather_condition?: ConditionRating | null
  temperature_celsius?: number | null
}

// ── Views ───────────────────────────────────────────────────────────────────

/** `vw_active_plants` */
export interface ActivePlantView {
  plant_id: number
  plant_species: string
  latitude: number
  longitude: number
  plant_status: PlantStatus
  planted_date: string
  last_verified_at: string | null
}

/** `vw_event_progress` */
export interface EventProgressView {
  event_id: number
  event_title: string
  start_date: string
  end_date: string
  event_status: EventStatus
  target_year_batch: string
  trees_per_student: number
  plants_assigned: number
  plants_completed: number
  completion_rate: number
}

/** `vw_student_progress` */
export interface StudentProgressView {
  student_id: number
  full_name: string
  year_batch: string
  tasks_assigned: number
  tasks_completed: number
  plants_verified: number
}

// ── Session / auth ──────────────────────────────────────────────────────────

/** `POST /api/auth/login` response body. */
export interface AuthSession {
  token: string
  user: StudentPublic
}

/** `GET /api/overview` response — backs the Command Overview stat cards. */
export interface OverviewStats {
  totalTreesVerified: number
  totalTreesTarget: number
  activeStaff: number
  pendingSubmissions: number
  incidentReports: number
  highPriorityIncidents: number
}

/** Shared envelope for list endpoints. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** `ecotrace_verification_photos` — PK `photo_id`, FK `verification_id`. */
export interface VerificationPhoto {
  photo_id: number
  verification_id: number
  photo_url: string
  photo_type: PhotoType
  file_size_bytes: number | null
  mime_type: string | null
  uploaded_at: string
}

/** `ecotrace_plant_reservations` — PK `reservation_id`. */
export interface PlantReservation {
  reservation_id: number
  plant_id: number
  student_id: number
  event_id: number | null
  reserved_at: string
  expires_at: string
  is_active: 0 | 1
  released_at: string | null
}
