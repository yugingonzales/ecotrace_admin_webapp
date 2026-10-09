# 📚 EcoTrace Documentation Index

This folder contains comprehensive guides for the EcoTrace Admin Portal and Flutter mobile app integration.

---

## 🚀 Quick Start

**New to the project?** Start here:

1. **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** - Understand how everything connects
2. **[ADMIN_SETUP.md](./ADMIN_SETUP.md)** - Create your first admin account
3. **[SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)** - Start the server and connect your Flutter app

---

## 📖 Documentation Files

### 🏗️ [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
**Complete system architecture with diagrams**

Learn how the React frontend, Node.js backend, and MariaDB database work together. Includes:
- System architecture diagram
- Component details (Frontend, Backend, Database)
- Connection flow explanation
- Configuration file reference
- Database schema overview

**When to read:** When you need to understand the big picture

---

### 🔐 [ADMIN_SETUP.md](./ADMIN_SETUP.md)
**Step-by-step admin account creation**

Create your first admin user to login to the portal. Includes:
- Quick 3-step setup instructions
- Default credentials (admin@ecotrace.local / admin123)
- SQL script explanation
- Troubleshooting common errors
- Password change instructions

**When to read:** When you need to create or reset admin accounts

---

### 🔌 [DATABASE_CONNECTION_EXPLAINED.md](./DATABASE_CONNECTION_EXPLAINED.md)
**How the admin portal connects to the database**

Quick reference for understanding database connections. Includes:
- Connection chain diagram
- Configuration file locations
- Important discovery: Two separate databases
- How to switch between databases

**When to read:** When you're confused about database connectivity

---

### 📱 [SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)
**Starting the server & connecting Flutter mobile app**

Comprehensive troubleshooting guide. Includes:
- How to start the backend server
- 6 solutions for connection issues
- Flutter API configuration (api_config.dart)
- Windows Firewall setup
- Network troubleshooting checklist
- Common error messages & fixes

**When to read:** When Flutter app can't reach the server

---

### 📝 [create-admin-user.sql](./create-admin-user.sql)
**SQL script to create admin account**

Ready-to-run SQL script with:
- Pre-generated bcrypt hash for password "admin123"
- Full user insertion with proper role assignment
- Verification queries

**When to use:** Run in phpMyAdmin to create admin account

---

### 🔧 [generate-hash.js](./generate-hash.js)
**Utility to generate bcrypt password hashes**

Node.js script to generate password hashes. Usage:
```bash
node generate-hash.js yourpassword
```

**When to use:** When you need to create/reset passwords manually

---

## 🎯 Common Tasks

### I want to...

#### ...login to the admin portal
1. Start XAMPP (MySQL)
2. Start backend: `cd server && npm run dev`
3. Start frontend: `npm run dev`
4. Open browser: `http://localhost:8443`
5. Login with credentials from [ADMIN_SETUP.md](./ADMIN_SETUP.md)

#### ...create an admin account
1. Follow [ADMIN_SETUP.md](./ADMIN_SETUP.md)
2. Run [create-admin-user.sql](./create-admin-user.sql) in phpMyAdmin
3. Login with default credentials

#### ...connect Flutter app to backend
1. Start backend server (see [SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md))
2. Find your PC's IP: `ipconfig`
3. Update `api_config.dart` with your IP
4. Rebuild Flutter app: `flutter clean && flutter run`

#### ...troubleshoot connection errors
1. Check [SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)
2. Use the troubleshooting checklist
3. Check common error messages section

#### ...understand the system architecture
1. Read [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
2. Review the connection flow diagram
3. Check configuration file references

---

## 🗂️ System Overview

### Components

| Component | Location | Port | Technology |
|-----------|----------|------|------------|
| **React Frontend** | `ecotrace_admin\` | 8443 | Vite + React 19 |
| **Node.js Backend** | `ecotrace_admin\server\` | 3000 | Express.js |
| **MariaDB Database** | XAMPP MySQL | 3306 | MariaDB 10.4 |
| **Flutter App** | `c:\flutter_workspace\ecotrace\` | - | Flutter/Dart |

### Database Names

| System | Database |
|--------|----------|
| **Admin Portal** | `ecotrace_db` |
| **Flutter App** | `ecotrace_v2_test` |

⚠️ **Note:** These are separate databases. See [DATABASE_CONNECTION_EXPLAINED.md](./DATABASE_CONNECTION_EXPLAINED.md) to switch.

---

## 🆘 Getting Help

### Connection Issues
→ [SERVER_STARTUP_AND_FLUTTER_CONNECTION.md](./SERVER_STARTUP_AND_FLUTTER_CONNECTION.md)

### Login Problems
→ [ADMIN_SETUP.md](./ADMIN_SETUP.md)

### Understanding System
→ [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)

### Database Questions
→ [DATABASE_CONNECTION_EXPLAINED.md](./DATABASE_CONNECTION_EXPLAINED.md)

---

## 📊 Quick Reference

### Start Everything

```bash
# 1. Start XAMPP
# (Use XAMPP Control Panel - Start Apache + MySQL)

# 2. Start Backend API
cd C:\xampp\htdocs\projects\ecotrace_admin\server
npm run dev

# 3. Start Frontend
cd C:\xampp\htdocs\projects\ecotrace_admin
npm run dev

# 4. Access Admin Portal
# Open browser: http://localhost:8443
```

### Test Connections

```bash
# Test backend health
curl http://localhost:3000/api/health

# Find your PC's IP
ipconfig | Select-String "IPv4.*192.168"

# Test from mobile device browser
# http://YOUR_PC_IP:3000/api/health
```

---

**Last Updated:** October 9, 2026 | **Happy Coding! 🌳💚**

