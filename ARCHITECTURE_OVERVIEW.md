# EcoTrace Admin Portal - Architecture Overview

## How Everything Connects

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR SETUP                                │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   React Frontend     │         │   Node.js Backend    │
│   (Vite Dev Server)  │         │   (Express API)      │
│                      │         │                      │
│ Port: 8443           │◄───────►│ Port: 3000           │
│ Location:            │  Proxy  │ Location:            │
│ C:\xampp\htdocs\     │  /api   │ C:\xampp\htdocs\     │
│ projects\            │         │ projects\            │
│ ecotrace_admin\      │         │ ecotrace_admin\      │
│                      │         │ server\              │
└──────────────────────┘         └──────────────────────┘
         │                                │
         │                                │
         │                                ▼
         │                       ┌──────────────────────┐
         │                       │   MariaDB Database   │
         │                       │   (XAMPP MySQL)      │
         │                       │                      │
         │                       │ Port: 3306           │
         │                       │ Database:            │
         │                       │ ecotrace_db          │
         │                       │                      │
         │                       │ User: root           │
         │                       │ Password: (empty)    │
         │                       └──────────────────────┘
         │
         └──────────────────────────┐
                                    │
                            ┌───────▼────────┐
                            │  phpMyAdmin    │
                            │  (Web UI)      │
                            │                │
                            │ http://        │
                            │ localhost/     │
                            │ phpmyadmin     │
                            └────────────────┘
```

---

## Component Details

### 1. React Frontend (Admin Portal UI)
**Location:** `C:\xampp\htdocs\projects\ecotrace_admin\`  
**Port:** `8443` (configurable via `VITE_PORT` env var)  
**Technology:** React 19 + Vite + TailwindCSS

**Key Files:**
- `src/components/Login.jsx` - Login form
- `src/services/api.js` - API client
- `.env.example` - Configuration template
- `vite.config.js` - Dev server & proxy config

**How to start:**
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin
npm run dev
```

**URL:** `http://localhost:8443`

---

### 2. Node.js Backend (REST API)
**Location:** `C:\xampp\htdocs\projects\ecotrace_admin\server\`  
**Port:** `3000` (configurable via `API_PORT` env var)  
**Technology:** Express.js + bcryptjs + JWT

**Key Files:**
- `server/.env` - Database connection config
- `server/src/index.js` - API entry point
- `server/src/auth-controller.js` - Login/register logic
- `server/src/db.js` - MariaDB connection pool

**Database Connection:**
```javascript
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD= 
DB_NAME=ecotrace_db  ⬅️ THIS IS YOUR DATABASE
```

**How to start:**
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin\server
npm run dev
```

**API Endpoints:**
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/register` - Create new volunteer account
- `GET /api/auth/profile` - Get user profile (requires JWT)
- `GET /api/health` - Database health check

---

### 3. MariaDB Database
**Location:** XAMPP MariaDB (datadir: `C:\xampp\mysql\data`)  
**Port:** `3306`  
**Database Name:** `ecotrace_db` ⚠️

**Important Tables:**
- `users` - User accounts (admin, officer, volunteer)
- `roles` - User roles (admin=1, officer=2, volunteer=3)
- `organizations` - Organizations/institutions
- `tree_records` - Tree data
- `events` - Event data
- And many more...

**Access Methods:**
1. **phpMyAdmin:** `http://localhost/phpmyadmin`
2. **Command line:** `C:\xampp\mysql\bin\mysql.exe -u root ecotrace_db`

---

## The Connection Flow

### When You Login:

1. **User enters credentials** in browser at `http://localhost:8443`

2. **React app sends request** to `/api/auth/login`

3. **Vite proxy forwards** request to `http://localhost:3000/api/auth/login`

4. **Express API receives** the request

5. **API queries MariaDB:**
   ```sql
   SELECT u.*, r.name AS role_name
   FROM users AS u 
   JOIN roles AS r ON r.id = u.role_id
   WHERE u.username = ? LIMIT 1
   ```

6. **API verifies password** using bcrypt:
   ```javascript
   await verifyPassword(plainPassword, user.password_hash)
   ```

7. **API returns JWT token** if successful:
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": {
       "id": 1,
       "username": "admin",
       "email": "admin@ecotrace.local",
       "role": "admin",
       "status": "active"
     }
   }
   ```

8. **React stores token** and displays dashboard

---

## Database Schema Used by Backend

The backend API expects this user schema:

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  org_id INT,
  role_id INT NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  staff_code VARCHAR(50),
  first_name VARCHAR(80) NOT NULL,
  middle_name VARCHAR(80),
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  password_hash VARCHAR(128) NOT NULL,  -- bcrypt hash
  phone VARCHAR(32),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

-- Seed data
INSERT INTO roles (id, name, description) VALUES
(1, 'admin', 'System Administrator'),
(2, 'officer', 'Organization Officer'),
(3, 'volunteer', 'Regular Volunteer');
```

---

## Why No Admin Account Exists

The schema creates:
✅ Table structures  
✅ Role definitions (admin, officer, volunteer)  
❌ **No user accounts** (empty `users` table)

You must manually create the admin account using the SQL script provided.

---

## Configuration Files Summary

### Frontend Config
**File:** `C:\xampp\htdocs\projects\ecotrace_admin\.env.local` (create it)
```bash
VITE_ENABLE_API=true           # Enable real API calls
VITE_API_BASE_URL=/api         # Proxy to backend
VITE_API_TIMEOUT_MS=15000      # Request timeout
```

### Backend Config
**File:** `C:\xampp\htdocs\projects\ecotrace_admin\server\.env` (already exists)
```bash
API_HOST=0.0.0.0
API_PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=                    # Empty for XAMPP default
DB_NAME=ecotrace_db            # ⬅️ YOUR DATABASE

JWT_SECRET=add8e250e95ea07f09e8fd03d4d35db0b95a162f70a74b0835d040861a27f28b
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=12
CORS_ORIGIN=*
```

---

## To Get Everything Working

### Step 1: Start XAMPP Services
```
✅ Apache (for phpMyAdmin)
✅ MySQL (MariaDB)
```

### Step 2: Create Admin Account
1. Open phpMyAdmin: `http://localhost/phpmyadmin`
2. Select database: `ecotrace_db`
3. Run the SQL script: `create-admin-user.sql`

### Step 3: Start Backend API
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin\server
npm run dev
```
Should see: `✓ API listening on 0.0.0.0:3000`

### Step 4: Start Frontend
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin
npm run dev
```
Should see: `✓ Local: http://localhost:8443/`

### Step 5: Login
- URL: `http://localhost:8443`
- Username: `admin`
- Password: `admin123`

---

## Key Differences From Flutter App

| Aspect | Flutter App | Admin Portal |
|--------|-------------|--------------|
| Database | `ecotrace_v2_test` | `ecotrace_db` |
| Backend | PHP (possibly) | Node.js Express |
| Port | Varies | 3000 (API) + 8443 (UI) |
| Auth | Mobile-specific | Web JWT |
| Location | `C:\flutter_workspace\ecotrace\` | `C:\xampp\htdocs\projects\ecotrace_admin\` |

⚠️ **These are separate systems!** The admin portal does NOT share the Flutter app's database.

---

## Need to Migrate Data?

If you want to use the Flutter app's database (`ecotrace_v2_test`), change:

**File:** `C:\xampp\htdocs\projects\ecotrace_admin\server\.env`
```bash
DB_NAME=ecotrace_v2_test  # Instead of ecotrace_db
```

Then restart the backend server and run the admin account creation SQL in that database.
