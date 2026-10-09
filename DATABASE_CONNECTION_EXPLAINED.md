# Quick Answer: Database Connection

## Your Question
> "wait, then how is the ecotrace_admin use the our ecotrace_db?"

## Short Answer

The **EcoTrace Admin Portal** connects to the database through a **Node.js backend API** that runs separately from the React frontend.

---

## The Connection Chain

```
React Admin Portal (port 8443)
         ↓
    /api proxy
         ↓
Node.js Express API (port 3000)
         ↓
    mysql2 library
         ↓
MariaDB Database (port 3306)
    Database: ecotrace_db
```

---

## Configuration Files

### Backend connects to database:
**File:** `C:\xampp\htdocs\projects\ecotrace_admin\server\.env`
```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ecotrace_db  ⬅️ This is your database name
```

### Frontend proxies to backend:
**File:** `C:\xampp\htdocs\projects\ecotrace_admin\vite.config.js`
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3000',  ⬅️ Backend API
    changeOrigin: true,
  },
}
```

---

## Important Discovery

**Your admin portal and Flutter app use DIFFERENT databases:**

| System | Database Name |
|--------|---------------|
| **Flutter App** | `ecotrace_v2_test` |
| **Admin Portal** | `ecotrace_db` |

They are **completely separate systems** with different databases!

---

## If You Want to Use the Same Database

Change the backend configuration:

**File:** `C:\xampp\htdocs\projects\ecotrace_admin\server\.env`
```bash
DB_NAME=ecotrace_v2_test  # Use Flutter app's database
```

Then restart the backend server and create the admin account in that database.

---

## See Full Details

- **ARCHITECTURE_OVERVIEW.md** - Complete architecture explanation with diagrams
- **ADMIN_SETUP.md** - Step-by-step admin account creation guide
- **create-admin-user.sql** - SQL script to create admin account
