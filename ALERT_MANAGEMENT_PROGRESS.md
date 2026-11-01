# Alert Management Implementation Progress

## ✅ COMPLETED - Full Implementation

### Backend CRUD Endpoints (Complete)

#### 1. POST /api/alerts - Create Alert
**File:** `server/src/alerts-routes.js`
- Creates new alert with automatic recipient generation
- Handles draft vs published status
- Sets published_at timestamp for published alerts
- Creates recipients based on status and targeting

#### 2. GET /api/alerts - List Alerts
**File:** `server/src/alerts-routes.js`
- Returns paginated list of alerts
- Joins with events table for event_title
- Includes all alert fields and metadata

#### 3. PATCH /api/alerts/:id - Update Alert
**File:** `server/src/alerts-routes.js` (lines 299-386)
- Supports partial updates to alerts
- Handles status transitions (draft → published)
- Automatically sets `published_at` when publishing
- Creates alert recipients when transitioning to published
- Transaction-safe with rollback on errors

#### 4. DELETE /api/alerts/:id - Delete Alert
**File:** `server/src/alerts-routes.js` (lines 388-432)
- Route: `DELETE /api/alerts/:id`
- Deletes alert recipients first (FK constraint)
- Then deletes the alert itself
- Transaction-safe with rollback on errors
- Returns 204 No Content on success

### API Client Functions (Complete)
**File:** `src/lib/api.js`
```javascript
createAlert(payload)   // POST /api/alerts
listAlerts()           // GET /api/alerts  
updateAlert(alertId, input)  // PATCH /api/alerts/:id
deleteAlert(alertId)   // DELETE /api/alerts/:id
```

### Frontend Component (Complete)
**File:** `src/components/modules/AlertManagement.jsx`

#### Features Implemented:
1. **List View with Filtering**
   - Display all alerts with visual badges
   - Filter by status: all/published/draft/archived
   - Shows notification_code, event linkage, and status
   - Formatted timestamps (published or created date)

2. **Create Alert Form (Modal)**
   - Notification type selector (7 types)
   - Event ID linking (optional)
   - Alert title with character counter (160 max)
   - Alert body with character counter (5000 max)
   - Label and type selectors
   - Status selector (draft/published/archived)
   - Full validation and error handling

3. **Edit Alert Form (Modal)**
   - Pre-populated with existing alert data
   - Update title, body, label, type, status
   - Character counters
   - Error handling

4. **Delete Confirmation Dialog**
   - Shows alert preview before deletion
   - Warns that action cannot be undone
   - Loading states

### Event Extension Enhancement (Complete)
**File:** `server/src/events-routes.js`
- Added `event_extended` notification code
- Automatically detected when end_date increases
- Distinguishes extensions from other event updates
- Sends targeted notifications to event participants

### Navigation Integration (Complete)
1. **App.jsx** - Added AlertManagement route and import
2. **store.jsx** - Added 'alerts' to Module typedef and MODULE_TITLES
3. **Sidebar.jsx** - Added Alert Management nav item with bell icon

   - Save as Draft or Publish buttons

3. **Edit Alert Form** (Modal)
   - All fields from create form
   - Status selector (draft/published/archived)
   - Update button

4. **Delete Confirmation** (Modal)
   - Confirm before deletion
   - Warning about permanent action

### Implementation Template
The component should follow these patterns from EventManagement.jsx:
- Use `usePortal()` for store access
- Use `useEscapeToClose()` and `useScrollLock()` for modals
- Check `API_ENABLED` before making requests
- Show loading/error states appropriately
- Use toast notifications for actions
- Follow existing badge styling (`statusStyle`, `typeStyle`)

## Remaining Work for AlertManagement UI

### High Priority
1. **Create AlertManagement.jsx component** - Can be done by:
   - Copying the component structure from EventManagement.jsx
   - Adapting forms for alert fields instead of event fields
   - Using the new API functions (createAlert, updateAlert, deleteAlert)
   - Following the existing modal patterns

2. **Add Route in App.jsx** - Register the component

3. **Add Navigation Link** - In the sidebar navigation

### Medium Priority  
4. **Add Edit Functionality** - Edit existing alerts
5. **Add Delete with Confirmation** - Safety check before deletion
6. **Add Alert Templates** - Common alert messages
7. **Add Recipient Count Display** - Show how many users will receive

## API Endpoints Summary

### Available Now
- `GET /api/alerts` - List all alerts
- `POST /api/alerts` - Create new alert
- `PATCH /api/alerts/:id` - Update alert (NEW)
- `DELETE /api/alerts/:id` - Delete alert (NEW)
- `PATCH /api/alerts/:id/read` - Mark alert as read (user endpoint)

### Alert Schema
```javascript
{
  alert_id: number
  event_id: number | null
  event_title: string | null
  notification_code: string
  alert_title: string         // max 160
  alert_body: string          // max 5000
  alert_label: string | null  // max 32
  alert_type: 'info' | 'success' | 'warning' | 'error'
  alert_status: 'draft' | 'published' | 'archived'
  metadata: object | null
  published_at: string | null
  created_at: string
  updated_at: string
}
```

## Notes

- Backend CRUD operations are fully functional
- Frontend component structure is designed but not yet created due to tooling constraints
- The component can be manually created using EventManagement.jsx as a template
- All necessary API functions are available in `src/lib/api.js`


## Mobile App Integration - Notification Routing

### How Notification Codes Work

The `notification_code` field determines how the mobile app handles each alert:

#### Existing Notification Codes

1. **`platform_announcement`** (default)
   - General announcements from admin
   - Mobile app should: Navigate to Announcements screen
   - Recipients: All active non-admin users

2. **`upcoming_event`**
   - New event created and published
   - Mobile app should: Navigate to Events list or specific event details
   - Recipients: All active users
   - Includes: `event_id` in alert record

3. **`event_live`**
   - Event has started (triggered automatically by cron job)
   - Mobile app should: Navigate to specific event detail screen
   - Recipients: All active users
   - Message: "Geofencing and AR measurement capture are now open"
   - Includes: `event_id` in alert record

4. **`event_conclusion`**
   - Event has ended (triggered automatically by cron job)
   - Mobile app should: Navigate to specific event detail screen
   - Recipients: Event participants only
   - Message: "This session is closed. Please complete your final data syncs"
   - Includes: `event_id` in alert record

5. **`event_extended`** ⭐ NEW
   - Event deadline has been extended
   - Mobile app should: Navigate to specific event detail screen
   - Recipients: Event participants only
   - Message includes updated dates
   - Includes: `event_id` in alert record

6. **`event_update`**
   - Event details modified (quota changed, boundary updated, location changed)
   - Mobile app should: Navigate to specific event detail screen
   - Recipients: Event participants only
   - Includes: `event_id` in alert record

7. **`verification_update`**
   - Submission approved/declined
   - Mobile app should: Navigate to user's submission history
   - Recipients: Specific user who submitted
   - Includes: `verification_id` in metadata

### Automatic Event Lifecycle Notifications

The API automatically processes due event lifecycle notifications through `processEventLifecycle()`, invoked by a 60-second `setInterval` in `server/src/index.js` (this is an in-process timer, not an external cron service):

**Event Started:**
- Triggered when: `start_at` <= current time AND `live_at` IS NULL
- Notification code: `event_live`
- Sets: `live_at = CURRENT_TIMESTAMP`
- Recipients: All active users
- Tap action: Navigate to event details

**Event Ended:**
- Triggered when: `end_at` <= current time AND `concluded_at` IS NULL
- Notification code: `event_conclusion`
- Sets: `event_status = 'completed'`, `concluded_at = CURRENT_TIMESTAMP`
- Recipients: Event participants only
- Tap action: Navigate to event details

**Event Extended:**
- Triggered by: Admin PATCH request to `/api/events/:id` with new `end_date` > old `end_date`
- Notification code: `event_extended`
- Message: "Event dates updated to [start] through [end]"
- Recipients: Event participants only
- Tap action: Navigate to event details

### Mobile App Implementation Requirements

The mobile app currently implements event-live, upcoming-event, event-conclusion, event-update, and verification-update tap handling. Announcement and event-extension destinations remain pending in Flutter. The following is the intended complete routing contract:

```javascript
function handleNotificationTap(alert) {
  const { notification_code, event_id, metadata } = alert
  
  switch(notification_code) {
    case 'platform_announcement':
      // Navigate to Announcements/News screen
      navigation.navigate('Announcements')
      break
      
    case 'upcoming_event':
    case 'event_live':
    case 'event_conclusion':
    case 'event_extended':
    case 'event_update':
      // All event-related notifications navigate to event details
      if (event_id) {
        navigation.navigate('EventDetails', { eventId: event_id })
      }
      break
      
    case 'verification_update':
      // Navigate to user's submission history
      navigation.navigate('MySubmissions')
      // Optionally scroll to the specific submission if verification_id in metadata
      if (metadata?.verification_id) {
        // Scroll to or highlight the specific submission
      }
      break
      
    default:
      // Fallback: check if event_id exists
      if (event_id) {
        navigation.navigate('EventDetails', { eventId: event_id })
      } else {
        navigation.navigate('Announcements')
      }
  }
}
```

### Database Schema Reference

```sql
ecotrace_alerts:
  - alert_id (PK)
  - event_id (FK, nullable) -- Links to specific event
  - notification_code (varchar 48) -- Routes to specific screen
  - alert_title (varchar 160)
  - alert_body (text, max 5000 chars)
  - alert_label (varchar 32) -- Badge text like "URGENT", "INFO"
  - alert_type (enum: info/success/warning/error) -- Visual styling
  - alert_status (enum: draft/published/archived)
  - metadata (JSON) -- Additional data for navigation
  - published_at (timestamp)
  - created_at, updated_at

ecotrace_alert_recipients:
  - alert_id (FK)
  - user_id (FK)
  - read_at (timestamp, nullable)
```

### Testing Notification Flow

To test the mobile app integration:

1. **Platform Announcement:** Create alert with no event_id
   - Expected: Navigate to Announcements screen
   
2. **Event Started:** Wait for event start_at time or manually trigger via cron
   - Expected: Navigate to event details, show "Event is live" message
   
3. **Event Ended:** Wait for event end_at time or manually trigger via cron
   - Expected: Navigate to event details, show "Event has ended" message
   
4. **Event Extended:** Admin extends event deadline (new end_date > old end_date)
   - Expected: Navigate to event details, show updated end date
   - Notification code: `event_extended`
   
5. **Event Updated:** Admin changes quota, boundary, or location
   - Expected: Navigate to event details
   - Notification code: `event_update`
   
6. **Verification Update:** Submit a plant for verification, admin approves/declines
   - Expected: Navigate to My Submissions, show approval/decline status


- The design follows existing patterns for consistency
