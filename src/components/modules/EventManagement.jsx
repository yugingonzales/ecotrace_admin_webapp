import { useEffect, useMemo, useState } from "react"

import EventBoundaryEditor from "../map/EventBoundaryEditor"

import { treesEligibleForVerification } from "../../lib/trees"

import { usePlants } from "../../lib/usePlants"

import { eventProgress, usePortal } from "../../lib/store"

import { useEscapeToClose, useScrollLock } from "../../lib/useEscapeToClose"

import { downloadCsv } from "../../lib/csv"

import {
  API_ENABLED,
  createEvent as createApiEvent,
  createAlert as createApiAlert,
  deleteEvent as deleteApiEvent,
  listEvents,
  updateEvent as updateApiEvent,
} from "../../lib/api"

/** @typedef {import('../../lib/site.js').Boundary} Boundary */

/** @typedef {import('../../lib/store.js').EventDraft} EventDraft */

/** @typedef {import('../../lib/store.js').PortalEvent} PortalEvent */

// Events now live in the shared store (`lib/store.jsx`) so Create, Extend and

// Reassign Quotas can mutate them. This module only reads.

/** @type {Record<string, string>} */

const statusStyle = {
  active: "badge-accent",

  completed: "badge-neutral",

  draft: "badge-warning",
}

/**
 * Module scope, not component scope: the list is a constant, and "Select all"
 * can only be correct if it is the *same* list the chips are rendered from.
 * Rebuilding it per render would have made `metrics.length === options.length`
 * compare against a fresh identity every time.
 * @type {readonly string[]}
 */

const METRIC_OPTIONS = [
  "GPS Coordinates",

  "Status Photo",

  "Tree Height (cm)",

  "Growth Stage",

  "Diameter Measurement (cm)",

  "Survival Status",
]

/**
 * @param {{ onClose: () => void, onCreated: (event: object) => void }} props
 */
function CreateEventForm({ onClose, onCreated }) {
  const { storeActions } = usePortal()

  const [error, setError] = useState(/** @type {string | null} */ (null))

  /**
   * @typedef {object} EventFormState
   * @property {string} title
   * @property {string} description
   * @property {string} plantFrom
   * @property {string} plantTo
   * @property {string} quota
   * @property {string} start
   * @property {string} end
   * @property {string} zone
   * @property {Boundary} boundary
   * @property {string} guidelines
   * @property {string[]} metrics
   */

  const [form, setForm] = useState(
    /** @type {EventFormState} */ ({
      title: "",

      description: "",

      plantFrom: "",

      plantTo: "",

      quota: "50",

      start: "",

      end: "",

      zone: "",

      boundary: /** @type {Boundary} */ ([]),

      guidelines: "",

      metrics: [...METRIC_OPTIONS],
    }),
  )

  /** @param {string} m */

  const toggleMetric = (m) => {
    setForm((f) => ({
      ...f,

      metrics: f.metrics.includes(m)
        ? f.metrics.filter((x) => x !== m)
        : [...f.metrics, m],
    }))
  }

  // "Select all" / "Clear all" as a single toggle, so there is only ever one

  // control to aim at regardless of the current selection. The chips stay

  // individually clickable for the common case of a couple of exceptions.

  const allMetricsSelected = form.metrics.length === METRIC_OPTIONS.length

  const toggleAllMetrics = () => {
    setForm((f) => ({
      ...f,
      metrics: allMetricsSelected ? [] : [...METRIC_OPTIONS],
    }))
  }

  // Fed from the same source as the map so the eligible-tree count never

  // contradicts the pins drawn beside it.

  const { markers } = usePlants()

  const eligibleTrees = useMemo(
    () =>
      treesEligibleForVerification(
        form.boundary,
        form.plantFrom,
        form.plantTo,
        markers,
      ),

    [form.boundary, form.plantFrom, form.plantTo, markers],
  )

  const [mapExpanded, setMapExpanded] = useState(false)

  useEscapeToClose(onClose)

  useScrollLock()

  /** One validator for both footer buttons, so Save-draft and Publish cannot
   *  disagree about what a valid event is. */

  /** @param {boolean} publish */

  const submit = (publish) => {
    if (!form.title.trim()) return setError("Event name is required.")

    if (!form.start) return setError("Start date is required.")

    if (!form.end) return setError("End date is required.")

    if (form.end < form.start)
      return setError("End date must be on or after the start date.")

    const quota = Number(form.quota)

    if (!Number.isFinite(quota) || quota < 1 || quota > 50) {
      return setError("Quota must be between 1 and 50 trees per staff member.")
    }

    // The field is labelled "Mandatory" and staff read it as the list of

    // parameters they must submit against, so a published event with none would

    // be a promise the portal does not keep. Drafts stay permissive — that is

    // the point of a draft.

    if (publish && form.metrics.length === 0) {
      return setError("Select at least one mandatory metric before publishing.")
    }

    setError(null)

    /** @type {EventDraft} */

    const draft = {
      title: form.title,

      description: form.description,

      plantFrom: form.plantFrom,

      plantTo: form.plantTo,

      quota: form.quota,

      start: form.start,

      end: form.end,

      zone: form.zone,

      boundary: form.boundary,

      guidelines: form.guidelines,

      metrics: form.metrics,
    }

    if (API_ENABLED) {
      createApiEvent({
        event_title: draft.title.trim(),

        event_description: draft.description || null,

        event_location: draft.zone || null,

        event_zone: draft.zone || null,

        event_boundary: draft.boundary,

        start_date: draft.start,

        end_date: draft.end,

        trees_per_student: Number(draft.quota),

        target_year_batch: draft.start.slice(0, 4),

        event_status: publish ? "active" : "draft",
        monitoring_metrics: draft.metrics,
      })
        .then(onCreated)
        .catch((error) => setError(error.message))

      return
    }

    storeActions.createEvent(draft, publish)

    onClose()
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Create New Event</h2>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Configure verification event details and staff assignment
            </p>
          </div>
          <button onClick={onClose} className="btn btn-sm">
            ✕
          </button>
        </div>

        <div className="modal-body space-y-5">
          {/* Eligible Trees Indicator */}
          {form.plantFrom && form.plantTo && (
            <div
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid rgba(47,158,110,0.3)",
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                stroke="var(--accent-dark)"
                strokeWidth="1.5"
              >
                <circle cx="8" cy="8" r="7" />
                <path
                  d="M5.5 8.5l2 2 3-3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-xs" style={{ color: "var(--accent-dark)" }}>
                <strong>
                  {eligibleTrees.length} existing tree
                  {eligibleTrees.length !== 1 ? "s" : ""}
                </strong>{" "}
                planted between{" "}
                {new Date(form.plantFrom + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", year: "numeric" },
                )}{" "}
                –{" "}
                {new Date(form.plantTo + "T00:00:00").toLocaleDateString(
                  "en-US",
                  { month: "short", year: "numeric" },
                )}
                {form.boundary.length >= 3
                  ? " inside the drawn boundary are eligible for verification."
                  : " are within the selected period. Draw a boundary to narrow results."}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="field-label">Event Title *</label>
              <input
                className="input"
                placeholder="e.g. Arbor Day Drive 2026"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="col-span-2">
              <label className="field-label">Description</label>
              <textarea
                className="textarea"
                placeholder="Briefly describe the event goals and context..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="field-label">Tree Planting Period *</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className="field-label"
                    style={{ fontSize: 10, color: "var(--text-muted)" }}
                  >
                    Planted From
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={form.plantFrom}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, plantFrom: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    className="field-label"
                    style={{ fontSize: 10, color: "var(--text-muted)" }}
                  >
                    Planted To
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={form.plantTo}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, plantTo: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="field-label">Quota per Staff *</label>
              <div className="relative">
                <input
                  type="number"
                  className="input"
                  value={form.quota}
                  min={1}
                  max={50}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, quota: e.target.value }))
                  }
                />
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  trees/staff
                </span>
              </div>
            </div>

            <div>
              <label className="field-label">Start Date *</label>
              <input
                type="date"
                className="input"
                value={form.start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, start: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="field-label">End Date *</label>
              <input
                type="date"
                className="input"
                value={form.end}
                onChange={(e) =>
                  setForm((f) => ({ ...f, end: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="field-label mb-0">
                  Event Field Boundary / Zone
                </label>
                <select
                  className="select"
                  style={{ width: "auto", padding: "5px 10px", fontSize: 11 }}
                  value={form.zone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, zone: e.target.value }))
                  }
                >
                  <option value="">Full campus map</option>
                  <option>Zone A – Main Campus</option>
                  <option>Zone B – Annex Field</option>
                  <option>Zone C – Hillside Reserve</option>
                </select>
              </div>

              <EventBoundaryEditor
                zoneLabel={form.zone}
                boundary={form.boundary}
                onChange={(b) => setForm((f) => ({ ...f, boundary: b }))}
                height={250}
                expanded={mapExpanded}
                onExpand={() => setMapExpanded(true)}
                onClose={() => setMapExpanded(false)}
              />

              <div
                className="mt-2"
                style={{ color: "var(--text-muted)", fontSize: 11 }}
              >
                Boundary defines the area where staff verifications are accepted
                — draw at least 3 points to close it.
              </div>
              {/* Eligible Trees Preview */}
              {form.plantFrom && form.plantTo && (
                <div
                  className="mt-3 rounded-lg border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span className="text-xs font-medium">
                      Trees to verify ({eligibleTrees.length})
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      inside boundary · planted in period
                    </span>
                  </div>
                  {eligibleTrees.length === 0 ? (
                    <div
                      className="px-3 py-3 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No trees match the current boundary and planting period.
                      {form.boundary.length < 3 &&
                        " Draw at least 3 boundary points to filter."}
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto px-1 py-1">
                      {eligibleTrees.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                        >
                          <span
                            className="inline-block rounded-full flex-shrink-0"
                            style={{
                              width: 8,

                              height: 8,

                              background:
                                t.status === "verified"
                                  ? "var(--accent)"
                                  : t.status === "pending"
                                    ? "var(--warning)"
                                    : t.status === "incident"
                                      ? "var(--danger)"
                                      : "var(--text-faint)",
                            }}
                          />
                          <span className="mono font-medium">{t.treeTag}</span>
                          <span className="italic flex-1 truncate">
                            {t.species}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            {t.datePlanted}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: "var(--text-faint)" }}
                          >
                            {t.zone}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="col-span-2">
              <div className="flex items-center justify-between gap-3 mb-2">
                <label className="field-label mb-0">
                  Mandatory Metrics
                  <span
                    className="ml-2 font-normal"
                    style={{ color: "var(--text-faint)" }}
                  >
                    {form.metrics.length} of {METRIC_OPTIONS.length} selected
                  </span>
                </label>
                <button
                  type="button"
                  onClick={toggleAllMetrics}
                  className="btn btn-sm"
                  style={{
                    color: "var(--accent-dark)",
                    borderColor: "var(--accent)",
                  }}
                  aria-pressed={allMetricsSelected}
                >
                  {allMetricsSelected ? "Clear all" : "Select all"}
                </button>
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Mandatory verification metrics"
              >
                {METRIC_OPTIONS.map((m) => {
                  const on = form.metrics.includes(m)

                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMetric(m)}
                      className="btn btn-sm"
                      aria-pressed={on}
                      style={{
                        borderColor: on ? "var(--accent)" : "var(--border)",

                        background: on ? "var(--accent-soft)" : "var(--field)",

                        color: on ? "var(--accent-dark)" : "var(--text-muted)",
                      }}
                    >
                      {on ? "✓ " : ""}
                      {m}
                    </button>
                  )
                })}
              </div>

              {form.metrics.length === 0 && (
                <p
                  className="mt-2 text-[11px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  No metrics selected. A draft can be saved without any;
                  publishing requires at least one.
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className="field-label">Event Guidelines</label>
              <textarea
                className="textarea"
                placeholder="Instructions staff will see when submitting verifications..."
                value={form.guidelines}
                onChange={(e) =>
                  setForm((f) => ({ ...f, guidelines: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        {error && (
          <div
            className="mx-5 mt-3 flex items-start gap-2 px-3 py-2.5 rounded text-xs"
            style={{
              background: "var(--danger-soft)",
              border: "1px solid rgba(220,58,58,0.3)",
              color: "var(--danger)",
            }}
            role="alert"
          >
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn">
            Cancel
          </button>
          <button onClick={() => submit(false)} className="btn">
            Save as Draft
          </button>
          <button onClick={() => submit(true)} className="btn btn-primary">
            Publish Event
          </button>
        </div>
      </div>
    </div>
  )
}

function apiEventToPortalEvent(event) {
  const start = new Date(`${event.start_date}T00:00:00`)

  const end = new Date(`${event.end_date}T00:00:00`)

  const rawBoundary = event.event_boundary
  let boundary = []
  if (Array.isArray(rawBoundary)) boundary = rawBoundary
  else if (typeof rawBoundary === "string" && rawBoundary.trim()) {
    try {
      const parsed = JSON.parse(rawBoundary)
      if (Array.isArray(parsed)) boundary = parsed
    } catch {
      boundary = []
    }
  }

  const display = (value) =>
    value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })

  return {
    id: `E${event.event_id}`,

    name: event.event_title,

    year: event.target_year_batch || String(start.getFullYear()),

    start: display(start),
    end: display(end),
    startIso: event.start_date,
    endIso: event.end_date,

    quota: event.trees_per_student,
    staff: event.attendee_count || 0,
    target: 0,
    verified: 0,

    pending: 0,
    incidents: 0,
    zone: event.event_zone || event.event_location || "Unspecified",

    status:
      event.event_status === "cancelled" ? "completed" : event.event_status,

    description: event.event_description || "",
    guidelines: "",
    metrics:
      Array.isArray(event.monitoring_metrics) && event.monitoring_metrics.length
        ? event.monitoring_metrics
        : [...METRIC_OPTIONS],
    boundary,
  }
}

function EditEventForm({ event, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: event.name,
    start: event.startIso,
    end: event.endIso,
    location: event.zone,
    quota: String(event.quota),
    metrics: [...event.metrics],
    boundary: event.boundary ?? [],
  })
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState(null)
  const toggleMetric = (metric) => setForm((current) => ({
    ...current,
    metrics: current.metrics.includes(metric)
      ? current.metrics.filter((item) => item !== metric)
      : [...current.metrics, metric],
  }))
  const submit = async (e) => {
    e.preventDefault()
    if (!API_ENABLED) { setError("Enable the API to modify persisted events."); return }
    try {
      const updated = await updateApiEvent(Number(event.id.replace(/^E/, "")), {
        event_title: form.title.trim(),
        start_date: form.start,
        end_date: form.end,
        event_location: form.location.trim(),
        event_zone: form.location.trim(),
        trees_per_student: Number(form.quota),
        monitoring_metrics: form.metrics,
        event_boundary: form.boundary,
      })
      onSaved(updated)
    } catch (cause) { setError(cause.message) }
  }
  return (
    <div className="overlay">
      <form className="modal" style={{ maxWidth: 760 }} onSubmit={submit}>
        <div className="modal-header"><div><h2 className="modal-title">Edit / Modify Event</h2><p className="text-xs" style={{ color: "var(--text-muted)" }}>Changes are announced to EcoTrace users.</p></div><button type="button" onClick={onClose} className="btn btn-sm">×</button></div>
        <div className="modal-body space-y-4">
          {error && <div className="text-xs" style={{ color: "var(--danger)" }}>{error}</div>}
          <div><label className="field-label">Event title *</label><input className="input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="field-label">Start date *</label><input className="input" type="date" required value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} /></div><div><label className="field-label">End date / extension *</label><input className="input" type="date" required value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} /></div></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="field-label">Target location / zone *</label><input className="input" required value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div><div><label className="field-label">Trees per staff member (reassign quota) *</label><input className="input" type="number" min="0" max="100000" required value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))} /></div></div>
          <div><div className="flex items-center justify-between"><label className="field-label mb-2">Verification metrics</label><button type="button" className="btn btn-sm" onClick={() => setForm((f) => ({ ...f, metrics: f.metrics.length === METRIC_OPTIONS.length ? [] : [...METRIC_OPTIONS] }))}>{form.metrics.length === METRIC_OPTIONS.length ? "Clear all" : "Select all"}</button></div><div className="flex flex-wrap gap-2">{METRIC_OPTIONS.map((metric) => <button type="button" key={metric} className="btn btn-sm" aria-pressed={form.metrics.includes(metric)} onClick={() => toggleMetric(metric)} style={{ borderColor: form.metrics.includes(metric) ? "var(--accent)" : "var(--border)", background: form.metrics.includes(metric) ? "var(--accent-soft)" : "var(--field)" }}>{form.metrics.includes(metric) ? "✓ " : ""}{metric}</button>)}</div></div>
          <div><label className="field-label">Geofencing boundary</label><EventBoundaryEditor zoneLabel={form.location} boundary={form.boundary} onChange={(boundary) => setForm((f) => ({ ...f, boundary }))} expanded={expanded} onExpand={() => setExpanded(true)} onClose={() => setExpanded(false)} /></div>
        </div>
        <div className="modal-footer"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">Save changes</button></div>
      </form>
    </div>
  )
}

function CreateAlertForm({ onClose }) {
  const [form, setForm] = useState({ title: "", body: "", label: "ANNOUNCEMENT", type: "info" })
  const [error, setError] = useState(null)
  const submit = async (event) => {
    event.preventDefault()
    try {
      await createApiAlert({ alert_title: form.title.trim(), alert_body: form.body.trim(), alert_label: form.label.trim() || "INFO", alert_type: form.type, alert_status: "published" })
      onClose()
    } catch (cause) { setError(cause.message) }
  }
  return (
    <div className="overlay"><form className="modal" style={{ maxWidth: 520 }} onSubmit={submit}>
      <div className="modal-header"><h2 className="modal-title">Publish Mobile Alert</h2><button type="button" onClick={onClose} className="btn btn-sm">×</button></div>
      <div className="modal-body space-y-4">
        {error && <div className="text-xs" style={{ color: "var(--danger)" }}>{error}</div>}
        <div><label className="field-label">Title *</label><input className="input" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
        <div><label className="field-label">Message *</label><textarea className="textarea" required value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="field-label">Category</label><select className="select" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}><option value="ANNOUNCEMENT">Announcement</option><option value="ALERT">Alert</option><option value="REMINDER">Reminder</option></select></div><div><label className="field-label">Severity</label><select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Urgent</option></select></div></div>
      </div>
      <div className="modal-footer"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">Publish alert</button></div>
    </form></div>
  )
}

export default function EventManagement() {
  const { events, storeActions } = usePortal()

  const [apiEvents, setApiEvents] = useState(null)

  useEffect(() => {
    if (!API_ENABLED) return

    listEvents()
      .then((result) => setApiEvents(result.items.map(apiEventToPortalEvent)))
      .catch(() => setApiEvents(null))
  }, [])

  const visibleData = apiEvents ?? events

  const [showCreate, setShowCreate] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  // Held as an id so the dashboard always renders the live row: after Extend

  // Quotas the old object would still show the pre-action end date.

  const [selectedId, setSelectedId] = useState(
    /** @type {string | null} */ (null),
  )

  const [yearFilter, setYearFilter] = useState("all")

  const [statusFilter, setStatusFilter] = useState("all")

  const selectedEvent = selectedId
    ? (visibleData.find((e) => e.id === selectedId) ?? null)
    : null

  const years = useMemo(
    () =>
      [...new Set(visibleData.map((e) => e.year))].sort((a, b) =>
        b.localeCompare(a),
      ),

    [visibleData],
  )

  const visibleEvents = visibleData.filter((e) => {
    if (yearFilter !== "all" && e.year !== yearFilter) return false

    if (statusFilter !== "all" && e.status !== statusFilter) return false

    return true
  })

  /** @param {PortalEvent} ev */

  const editSelectedEvent = () => {
    if (selectedEvent) setShowEdit(true)
  }

  const removeSelectedEvent = async () => {
    if (!selectedEvent || !window.confirm(`Delete ${selectedEvent.name}? This cannot be undone.`)) return
    try {
      if (!API_ENABLED) {
        window.alert("Enable the API to delete persisted events.")
        return
      }
      if (API_ENABLED) {
        await deleteApiEvent(Number(selectedEvent.id.replace(/^E/, "")))
        setApiEvents((current) => (current ?? []).filter((item) => item.id !== selectedEvent.id))
      }
      setSelectedId(null)
    } catch (error) { window.alert(error.message) }
  }

  const exportLog = (ev) => {
    const n = downloadCsv(
      `ecotrace_event_${ev.id}_log.csv`,

      [
        "Event",
        "Event ID",
        "S.Y.",
        "Zone",
        "Start",
        "End",
        "Quota / staff",
        "Staff",
        "Target",
        "Verified",
        "Pending",
        "Incidents",
        "Status",
      ],

      [
        [
          ev.name,
          ev.id,
          ev.year,
          ev.zone,
          ev.start,
          ev.end,
          ev.quota,
          ev.staff,
          ev.target,
          ev.verified,
          ev.pending,
          ev.incidents,
          ev.status,
        ],
      ],
    )

    storeActions.recordExport(`Exported ${ev.name} (${ev.id}) summary (CSV)`, n)
  }

  return (
    <div>
      {showAlert && <CreateAlertForm onClose={() => setShowAlert(false)} />}
      {showEdit && selectedEvent && <EditEventForm event={selectedEvent} onClose={() => setShowEdit(false)} onSaved={(updated) => { setApiEvents((current) => (current ?? []).map((item) => item.id === selectedEvent.id ? apiEventToPortalEvent(updated) : item)); setShowEdit(false) }} />}

      {showCreate && (
        <CreateEventForm
          onClose={() => setShowCreate(false)}
          onCreated={(event) => {
            setApiEvents((current) => [
              ...(current ?? []),
              apiEventToPortalEvent(event),
            ])

            setShowCreate(false)
          }}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold mb-1">Event Management</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Create, configure, and monitor verification events
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAlert(true)} className="btn">Publish Alert</button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary"><span>+</span> New Event</button>
        </div>
      </div>

      {/* Selected Event Dashboard */}
      {selectedEvent && (
        <div className="card mb-5">
          <div className="card-header flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="card-title">{selectedEvent.name}</h2>
                <span className={`badge ${statusStyle[selectedEvent.status]}`}>
                  {selectedEvent.status}
                </span>
              </div>
              <div
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                {selectedEvent.zone} · {selectedEvent.start} →{" "}
                {selectedEvent.end}
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <button className="btn btn-sm" onClick={editSelectedEvent}>Edit / Modify</button>
              <button className="btn btn-sm" style={{ color: "var(--danger)" }} onClick={removeSelectedEvent}>Delete</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => exportLog(selectedEvent)}
              >
                Export Log ↓
              </button>
              <button
                onClick={() => setSelectedId(null)}
                className="btn btn-sm"
                aria-label="Close event dashboard"
              >
                ✕
              </button>
            </div>
          </div>
          <div
            className="grid grid-cols-5 divide-x"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {(() => {
              // A brand-new event has no staff assigned yet, so there is no

              // meaningful completion figure. Show '—' rather than inventing 0%.

              const pct = eventProgress(selectedEvent)

              return [
                {
                  label: "Target Trees",

                  value:
                    selectedEvent.target > 0
                      ? selectedEvent.target.toLocaleString()
                      : "—",

                  sub: `${selectedEvent.quota} / staff`,
                },

                {
                  label: "Verified",

                  value: selectedEvent.verified.toLocaleString(),

                  sub:
                    pct === null
                      ? "awaiting staff assignment"
                      : `${pct}% complete`,

                  color: "var(--accent)",
                },

                {
                  label: "Active Staff",

                  value:
                    selectedEvent.staff > 0
                      ? selectedEvent.staff.toLocaleString()
                      : "—",

                  sub: `S.Y. ${selectedEvent.year}`,
                },

                {
                  label: "Pending",
                  value: selectedEvent.pending,
                  sub: "awaiting review",
                  color: "var(--warning)",
                },

                {
                  label: "Incidents",
                  value: selectedEvent.incidents,
                  sub: "reports filed",
                  color: "var(--danger)",
                },
              ].map((s, i) => (
                <div key={i} className="px-5 py-3.5">
                  <div
                    className="text-xs mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: s.color || "var(--text)" }}
                  >
                    {s.value}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {s.sub}
                  </div>
                </div>
              ))
            })()}
          </div>
          <div className="px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="progress flex-1">
                <div
                  style={{ width: `${eventProgress(selectedEvent) ?? 0}%` }}
                />
              </div>
              <span
                className="text-xs font-medium mono"
                style={{ color: "var(--text-muted)" }}
              >
                {eventProgress(selectedEvent) === null
                  ? "No target set"
                  : `${eventProgress(selectedEvent)}% verified`}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Events Table */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="card-title">All Events</h2>
          <div className="flex items-center gap-2">
            <select
              className="select"
              style={{ width: "auto", padding: "5px 10px" }}
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Filter by school year"
            >
              <option value="all">All Years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              className="select"
              style={{ width: "auto", padding: "5px 10px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Event Name</th>
              <th>S.Y.</th>
              <th>Duration</th>
              <th className="num">Staff</th>
              <th className="num">Verified / Target</th>
              <th className="num">Incidents</th>
              <th className="text-center">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((ev) => {
              const pct = eventProgress(ev)

              return (
                <tr
                  key={ev.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedId(ev.id)}
                >
                  <td>
                    <div className="font-medium">{ev.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-muted)", fontSize: 11 }}
                    >
                      {ev.id} · {ev.zone}
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{ev.year}</td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {ev.start}
                    <br />
                    <span style={{ color: "var(--text-faint)" }}>
                      → {ev.end}
                    </span>
                  </td>
                  <td className="num mono">{ev.staff.toLocaleString()}</td>
                  <td className="num">
                    <div className="mono">
                      {ev.verified.toLocaleString()} /{" "}
                      {ev.target > 0 ? ev.target.toLocaleString() : "—"}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <div className="progress" style={{ width: 50 }}>
                        <div style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span
                        style={{ color: "var(--text-muted)", fontSize: 10 }}
                      >
                        {pct === null ? "—" : `${pct}%`}
                      </span>
                    </div>
                  </td>
                  <td className="num">
                    <span
                      className="mono"
                      style={{
                        color:
                          ev.incidents > 5
                            ? "var(--danger)"
                            : "var(--text-muted)",
                      }}
                    >
                      {ev.incidents}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={`badge ${statusStyle[ev.status]}`}>
                      {ev.status === "active"
                        ? "Active"
                        : ev.status === "completed"
                          ? "Completed"
                          : "Draft"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      className="btn btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()

                        setSelectedId(ev.id)
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visibleEvents.length === 0 && (
          <div
            className="py-12 text-center text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            No events match the current year and status filters.
          </div>
        )}
      </div>
    </div>
  )
}
