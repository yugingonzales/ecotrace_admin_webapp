import { useEffect, useState } from "react"
import { useEscapeToClose, useScrollLock } from "../../lib/useEscapeToClose"
import { API_ENABLED, createAlert, listAlerts, updateAlert, deleteAlert } from "../../lib/api"

function CreateAlertForm({ onClose, onCreated }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: "", body: "", label: "INFO", type: "info", status: "published", eventId: "", notificationCode: "platform_announcement" })
  useEscapeToClose(onClose)
  useScrollLock()
  const submit = () => {
    if (!form.title.trim()) return setError("Alert title is required.")
    if (!form.body.trim()) return setError("Alert body is required.")
    if (form.title.length > 160) return setError("Title must be 160 characters or less.")
    setError(null)
    setLoading(true)
    const payload = { alert_title: form.title.trim(), alert_body: form.body.trim(), alert_label: form.label, alert_type: form.type, alert_status: form.status, event_id: form.eventId ? Number(form.eventId) : null, notification_code: form.notificationCode }
    if (API_ENABLED) {
      createAlert(payload).then((result) => { onCreated(result); onClose() }).catch((error) => { setError(error.message); setLoading(false) })
    } else { setError("API not enabled"); setLoading(false) }
  }
  return (<div className="overlay"><div className="modal" style={{ maxWidth: 600 }}><div className="modal-header"><div><h2 className="modal-title">Create Alert</h2><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Send notifications to mobile app users</p></div><button onClick={onClose} className="btn btn-sm" disabled={loading}>✕</button></div><div className="modal-body space-y-4">{error && <div className="alert alert-error"><span>{error}</span></div>}<div><label className="field-label">Notification Type</label><select className="select" value={form.notificationCode} onChange={(e) => setForm((f) => ({ ...f, notificationCode: e.target.value }))} disabled={loading}><option value="platform_announcement">Platform Announcement</option><option value="upcoming_event">Upcoming Event</option><option value="event_live">Event Live</option><option value="event_conclusion">Event Conclusion</option><option value="event_extended">Event Extended</option><option value="event_update">Event Update</option><option value="verification_update">Verification Update</option></select></div><div><label className="field-label">Event ID (optional)</label><input type="number" className="input" value={form.eventId} onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))} disabled={loading} /></div><div><label className="field-label">Alert Title *</label><input className="input" maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} disabled={loading} /><div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{form.title.length}/160 characters</div></div><div><label className="field-label">Alert Body *</label><textarea className="textarea" rows={5} maxLength={5000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} disabled={loading} /><div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{form.body.length}/5000 characters</div></div><div className="grid grid-cols-2 gap-4"><div><label className="field-label">Label</label><input className="input" maxLength={32} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} disabled={loading} /></div><div><label className="field-label">Type</label><select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} disabled={loading}><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option></select></div></div><div><label className="field-label">Status</label><select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={loading}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div></div><div className="modal-footer"><button onClick={onClose} className="btn btn-ghost" disabled={loading}>Cancel</button><button onClick={submit} className="btn btn-primary" disabled={loading}>{loading ? "Creating..." : "Create Alert"}</button></div></div></div>)
}

function EditAlertForm({ alert, onClose, onUpdated }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: alert.alert_title || "", body: alert.alert_body || "", label: alert.alert_label || "INFO", type: alert.alert_type || "info", status: alert.alert_status || "published" })
  useEscapeToClose(onClose)
  useScrollLock()
  const submit = () => {
    if (!form.title.trim()) return setError("Alert title is required.")
    if (!form.body.trim()) return setError("Alert body is required.")
    setError(null)
    setLoading(true)
    const payload = { alert_title: form.title.trim(), alert_body: form.body.trim(), alert_label: form.label, alert_type: form.type, alert_status: form.status }
    if (API_ENABLED) {
      updateAlert(alert.alert_id, payload).then((result) => { onUpdated(result); onClose() }).catch((error) => { setError(error.message); setLoading(false) })
    } else { setError("API not enabled"); setLoading(false) }
  }
  return (<div className="overlay"><div className="modal" style={{ maxWidth: 600 }}><div className="modal-header"><div><h2 className="modal-title">Edit Alert</h2></div><button onClick={onClose} className="btn btn-sm" disabled={loading}>✕</button></div><div className="modal-body space-y-4">{error && <div className="alert alert-error"><span>{error}</span></div>}<div><label className="field-label">Alert Title *</label><input className="input" maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} disabled={loading} /></div><div><label className="field-label">Alert Body *</label><textarea className="textarea" rows={5} maxLength={5000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} disabled={loading} /></div><div className="grid grid-cols-2 gap-4"><div><label className="field-label">Label</label><input className="input" maxLength={32} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} disabled={loading} /></div><div><label className="field-label">Type</label><select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} disabled={loading}><option value="info">Info</option><option value="success">Success</option><option value="warning">Warning</option><option value="error">Error</option></select></div></div><div><label className="field-label">Status</label><select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={loading}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div></div><div className="modal-footer"><button onClick={onClose} className="btn btn-ghost" disabled={loading}>Cancel</button><button onClick={submit} className="btn btn-primary" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</button></div></div></div>)
}

function DeleteAlertConfirm({ alert, onClose, onDeleted }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  useEscapeToClose(onClose)
  useScrollLock()
  const confirmDelete = () => {
    setError(null)
    setLoading(true)
    if (API_ENABLED) {
      deleteAlert(alert.alert_id).then(() => { onDeleted(); onClose() }).catch((error) => { setError(error.message); setLoading(false) })
    } else { setError("API not enabled"); setLoading(false) }
  }
  return (<div className="overlay"><div className="modal" style={{ maxWidth: 480 }}><div className="modal-header"><h2 className="modal-title">Delete Alert</h2><button onClick={onClose} className="btn btn-sm" disabled={loading}>✕</button></div><div className="modal-body">{error && <div className="alert alert-error mb-4"><span>{error}</span></div>}<p>Are you sure you want to delete this alert?</p><div className="mt-3 p-3 rounded" style={{ background: "var(--surface-2)" }}><div className="text-sm font-medium">{alert.alert_title}</div><div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{alert.alert_body?.substring(0, 100)}{alert.alert_body && alert.alert_body.length > 100 ? "..." : ""}</div></div><p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p></div><div className="modal-footer"><button onClick={onClose} className="btn btn-ghost" disabled={loading}>Cancel</button><button onClick={confirmDelete} className="btn btn-error" disabled={loading}>{loading ? "Deleting..." : "Delete Alert"}</button></div></div></div>)
}

export default function AlertManagement() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAlert, setEditingAlert] = useState(null)
  const [deletingAlert, setDeletingAlert] = useState(null)
  const [filterStatus, setFilterStatus] = useState("all")

  useEffect(() => {
    if (!API_ENABLED) {
      setError("API not enabled. Set VITE_ENABLE_API=true in .env.local")
      setLoading(false)
      return
    }
    loadAlerts()
  }, [])

  const loadAlerts = () => {
    setLoading(true)
    setError(null)
    listAlerts().then((response) => { setAlerts(response.items || []); setLoading(false) }).catch((error) => { setError(error.message); setLoading(false) })
  }

  const handleCreated = (newAlert) => { setAlerts((prev) => [newAlert, ...prev]) }
  const handleUpdated = (updatedAlert) => { setAlerts((prev) => prev.map((a) => (a.alert_id === updatedAlert.alert_id ? updatedAlert : a))) }
  const handleDeleted = () => { if (deletingAlert) { setAlerts((prev) => prev.filter((a) => a.alert_id !== deletingAlert.alert_id)) } }

  const filteredAlerts = alerts.filter((alert) => { if (filterStatus === "all") return true; return alert.alert_status === filterStatus })

  const getTypeColor = (type) => {
    switch (type) {
      case "success": return "var(--accent)"
      case "warning": return "#f59e0b"
      case "error": return "#ef4444"
      default: return "var(--primary)"
    }
  }

  return (
    <div className="module">
      <div className="module-header">
        <div>
          <h1 className="module-title">Alert Management</h1>
          <p className="module-subtitle">Send push notifications to mobile app users</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(true)} disabled={!API_ENABLED}>+ Create Alert</button>
      </div>
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Filter by Status:</label>
          <div className="flex gap-2">
            <button className={`btn btn-sm $${filterStatus === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("all")}>All</button>
            <button className={`btn btn-sm $${filterStatus === "published" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("published")}>Published</button>
            <button className={`btn btn-sm $${filterStatus === "draft" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("draft")}>Draft</button>
            <button className={`btn btn-sm $${filterStatus === "archived" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilterStatus("archived")}>Archived</button>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="card flex items-center justify-center py-12"><div className="spinner" /><p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>Loading alerts...</p></div>
      ) : error ? (
        <div className="alert alert-error"><span>{error}</span></div>
      ) : filteredAlerts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-12"><p style={{ color: "var(--text-muted)" }}>{filterStatus === "all" ? "No alerts found. Create your first alert to get started." : `No $${filterStatus} alerts found.`}</p></div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div key={alert.alert_id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge" style={{ backgroundColor: getTypeColor(alert.alert_type), color: "white" }}>{alert.alert_label}</span>
                    <span className={`badge $${alert.alert_status === "published" ? "badge-accent" : alert.alert_status === "draft" ? "badge-warning" : "badge-neutral"}`}>{alert.alert_status}</span>
                    {alert.notification_code && <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{alert.notification_code}</span>}
                    {alert.event_id && <span className="text-xs px-2 py-1 rounded" style={{ background: "var(--accent-soft)", color: "var(--accent-dark)" }}>Event #{alert.event_id}{alert.event_title && ` - $${alert.event_title}`}</span>}
                  </div>
                  <h3 className="font-medium mb-1">{alert.alert_title}</h3>
                  <p className="text-sm mb-2" style={{ color: "var(--text-muted)", maxWidth: "800px" }}>{alert.alert_body}</p>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{alert.published_at ? `Published $${new Date(alert.published_at).toLocaleString()}` : `Created $${new Date(alert.created_at).toLocaleString()}`}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditingAlert(alert)} title="Edit alert">✏️</button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setDeletingAlert(alert)} title="Delete alert">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreateForm && <CreateAlertForm onClose={() => setShowCreateForm(false)} onCreated={handleCreated} />}
      {editingAlert && <EditAlertForm alert={editingAlert} onClose={() => setEditingAlert(null)} onUpdated={handleUpdated} />}
      {deletingAlert && <DeleteAlertConfirm alert={deletingAlert} onClose={() => setDeletingAlert(null)} onDeleted={handleDeleted} />}
    </div>
  )
}