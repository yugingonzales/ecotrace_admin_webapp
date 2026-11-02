import { pool } from "./db.js"

/**
 * Creates a published alert and its recipient rows in the caller's transaction.
 * `userIds` targets personal notifications; `allUsers` targets active non-admins.
 */

export async function createPublishedAlert(
  connection,
  {
    eventId = null,

    notificationCode,

    title,

    body,

    label = "INFO",

    type = "info",

    metadata = null,

    createdBy = null,

    userIds = null,

    allUsers = false,

    eventParticipants = false,
  },
) {
  const [result] = await connection.query(
    `INSERT INTO ecotrace_alerts
      (event_id, notification_code, alert_title, alert_body, metadata, alert_label,
       alert_type, alert_status, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP, ?)`,

    [
      eventId,
      notificationCode,
      title,
      body,
      metadata == null ? null : JSON.stringify(metadata),
      label,
      type,
      createdBy,
    ],
  )

  const alertId = result.insertId

  if (allUsers) {
    await connection.query(
      `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
       SELECT ?, u.id FROM users AS u JOIN roles AS r ON r.id = u.role_id
       WHERE u.status = 'active' AND r.name <> 'admin'`,

      [alertId],
    )
  } else if (eventParticipants) {
    await connection.query(
      `INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id)
       SELECT ?, user_id FROM ecotrace_event_participation
       WHERE event_id = ? AND participation_status = 'joined'`,

      [alertId, eventId],
    )
  } else if (userIds?.length) {
    for (const userId of userIds) {
      await connection.query(
        "INSERT IGNORE INTO ecotrace_alert_recipients (alert_id, user_id) VALUES (?, ?)",

        [alertId, userId],
      )
    }
  }

  return alertId
}

/** Create lifecycle alerts and advance due scheduled events. */

export async function processEventLifecycle(now = new Date()) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [events] = await connection.query(
      `SELECT event_id, event_title, event_description, event_location, event_zone,
              start_at, end_at, live_at, closing_at, concluded_at, event_status
       FROM ecotrace_events
       WHERE event_status = 'active'
         AND ((start_at IS NOT NULL AND start_at <= ? AND live_at IS NULL)
           OR (end_at IS NOT NULL AND end_at <= ? AND concluded_at IS NULL)
           OR (start_at IS NOT NULL AND start_at <= ? AND end_at IS NOT NULL AND end_at > ? AND end_at <= DATE_ADD(?, INTERVAL 2 DAY) AND closing_at IS NULL))
       FOR UPDATE`,

      [now, now, now, now, now],
    )

    for (const event of events) {
      if (
        event.end_at &&
        !event.concluded_at &&
        new Date(event.end_at) <= now
      ) {
        await connection.query(
          `UPDATE ecotrace_events SET event_status = 'completed', concluded_at = COALESCE(concluded_at, CURRENT_TIMESTAMP)
           WHERE event_id = ?`,

          [event.event_id],
        )

        await createPublishedAlert(connection, {
          eventId: event.event_id,

          notificationCode: "event_conclusion",

          title: `${event.event_title} has ended`,

          body: "This session is closed. Please complete your final data syncs.",

          label: "EVENT ENDED",

          type: "info",

          metadata: { event_id: event.event_id },

          eventParticipants: true,
        })
      } else if (
        event.start_at &&
        !event.live_at &&
        new Date(event.start_at) <= now
      ) {
        await connection.query(
          `UPDATE ecotrace_events SET live_at = COALESCE(live_at, CURRENT_TIMESTAMP)
           WHERE event_id = ?`,

          [event.event_id],
        )

        await createPublishedAlert(connection, {
          eventId: event.event_id,

          notificationCode: "event_live",

          title: `${event.event_title} is live`,

          body: "Geofencing and AR measurement capture are now open.",

          label: "EVENT LIVE",

          type: "success",

          metadata: { event_id: event.event_id },

          allUsers: true,
        })
      } else if (
        event.end_at &&
        !event.closing_at &&
        new Date(event.end_at) > now &&
        new Date(event.end_at).getTime() - now.getTime() <=
          2 * 24 * 60 * 60 * 1000
      ) {
        await connection.query(
          `UPDATE ecotrace_events SET closing_at = COALESCE(closing_at, CURRENT_TIMESTAMP)
           WHERE event_id = ?`,

          [event.event_id],
        )

        await createPublishedAlert(connection, {
          eventId: event.event_id,

          notificationCode: "event_closing",

          title: `${event.event_title} is closing soon`,

          body: "This event ends within two days. Complete your remaining activity before the deadline.",

          label: "CLOSING SOON",

          type: "warning",

          metadata: { event_id: event.event_id, end_at: event.end_at },

          eventParticipants: true,
        })
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback().catch(() => {})

    throw error
  } finally {
    connection.release()
  }
}
