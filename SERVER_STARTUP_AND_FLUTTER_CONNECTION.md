# Starting the Backend Server & Troubleshooting Flutter App Connection

## Quick Start Guide

### Prerequisites
1. ✅ XAMPP MySQL/MariaDB is running
2. ✅ Admin account created in database (see `ADMIN_SETUP.md`)
3. ✅ Node.js installed (v20 or higher)

---

## How to Start the Backend Server

### Step 1: Navigate to Server Directory
```bash
cd C:\xampp\htdocs\projects\ecotrace_admin\server
```

### Step 2: Install Dependencies (First Time Only)
```bash
npm install
```

### Step 3: Start the Server

**Development Mode (with auto-restart):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### Step 4: Verify Server is Running

You should see:
```
[ecotrace-api] listening on http://0.0.0.0:3000
[ecotrace-api] LAN clients can use http://<PC_LAN_IP>:3000/api
```

**Test the server:**
Open browser: `http://localhost:3000/api/health`

Should return:
```json
{
  "status": "ok",
  "service": "ecotrace-api",
  "database": {
    "ok": true,
    "latencyMs": 5
  },
  "timestamp": "2026-10-09T14:49:32.744Z"
}
```

---

## Flutter Mobile App Cannot Reach Server

### Problem Overview

The Flutter app (EcoTrace mobile) needs to connect to your backend server but encounters connection errors.

### Root Causes

1. **Wrong IP address in Flutter app configuration**
2. **Server not running or blocked by firewall**
3. **Android cleartext traffic blocked (already configured ✅)**
4. **Device not on same network as PC**

---

## Solution 1: Configure Flutter App API Endpoint

### Current Configuration

**File:** `c:\flutter_workspace\ecotrace\lib\core\config\api_config.dart`

```dart
class ApiConfig {
  // Currently set to:
  static const String baseUrl = 'http://192.168.1.79:3000/api';
  
  // Auth endpoints
  static const String register = '$baseUrl/auth/register';
  static const String login = '$baseUrl/auth/login';
  static const String profile = '$baseUrl/auth/profile';
  static const String health = '$baseUrl/health';
}
```

### Fix Based on Your Device Type

#### Option A: Android Emulator (AVD)
```dart
static const String baseUrl = 'http://10.0.2.2:3000/api';
```
**Why?** Android emulator uses `10.0.2.2` to reach the host PC's `localhost`.

#### Option B: Physical Android Device
```dart
static const String baseUrl = 'http://YOUR_PC_LAN_IP:3000/api';
```

**Your Current PC LAN IP:** Based on your network scan:
- Wi-Fi: `192.168.1.42`
- Mobile Hotspot: `192.168.137.1`

**Updated configuration:**
```dart
static const String baseUrl = 'http://192.168.1.42:3000/api';
```

#### Option C: iOS Simulator
```dart
static const String baseUrl = 'http://localhost:3000/api';
```
**Why?** iOS simulator shares the same network stack as the host Mac.

---

## Solution 2: Find Your PC's LAN IP Address

### Windows (PowerShell)
```powershell
ipconfig | Select-String "IPv4.*192.168"
```

### Windows (Command Prompt)
```cmd
ipconfig | findstr "IPv4"
```

### Common IP Ranges
- Home Wi-Fi: `192.168.0.x` or `192.168.1.x`
- Mobile Hotspot: `192.168.137.x`
- Corporate Network: Varies

**Current detected IPs:**
- Wi-Fi: `192.168.1.42` ⬅️ Use this if phone is on same Wi-Fi
- Hotspot: `192.168.137.1` ⬅️ Use this if phone is on PC's hotspot

---

## Solution 3: Allow Server Through Windows Firewall

### Check if Port 3000 is Blocked

```powershell
# Test from another device on same network
curl http://YOUR_PC_IP:3000/api/health
```

### Add Firewall Rule (If Blocked)

**Method 1: PowerShell (Run as Administrator)**
```powershell
New-NetFirewallRule -DisplayName "EcoTrace API Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

**Method 2: Windows Defender Firewall GUI**
1. Open **Windows Defender Firewall with Advanced Security**
2. Click **Inbound Rules** → **New Rule**
3. Select **Port** → Next
4. Select **TCP**, **Specific local ports: 3000** → Next
5. Select **Allow the connection** → Next
6. Check all profiles (Domain, Private, Public) → Next
7. Name: `EcoTrace API Server` → Finish

---

## Solution 4: Ensure Device and PC on Same Network

### Requirements
- ✅ **PC and phone must be on the SAME Wi-Fi network**
- ✅ OR phone connected to PC's mobile hotspot
- ❌ Phone on mobile data = WILL NOT WORK

### Verification Steps

1. **On PC:** Check Wi-Fi network name
   ```powershell
   netsh wlan show interfaces | Select-String "SSID"
   ```

2. **On Phone:** Settings → Wi-Fi → Check connected network

3. **Must match:** Both should show the same network name

---

## Solution 5: Test Connection from Flutter App

### Add Health Check Button (Testing Purpose)

**File:** `lib/core/config/api_config.dart` (already has health endpoint)

**Test in your app:**
```dart
import 'package:http/http.dart' as http;
import 'package:ecotrace/core/config/api_config.dart';

Future<void> testConnection() async {
  try {
    final response = await http.get(Uri.parse(ApiConfig.health));
    print('✅ Server reachable: ${response.statusCode}');
    print('Response: ${response.body}');
  } catch (e) {
    print('❌ Cannot reach server: $e');
  }
}
```

---

## Solution 6: Android Cleartext Traffic (Already Configured ✅)

Your `AndroidManifest.xml` already has this:
```xml
<application
    android:usesCleartextTraffic="true">
```

✅ **No action needed** - HTTP (non-HTTPS) traffic is allowed.

---

## Troubleshooting Checklist

Use this checklist to diagnose connection issues:

### On PC (Server Side)

- [ ] XAMPP MySQL is running
- [ ] Backend server is running (`npm run dev`)
- [ ] Server shows: `listening on http://0.0.0.0:3000`
- [ ] Browser test works: `http://localhost:3000/api/health`
- [ ] Know your PC's LAN IP address
- [ ] Windows Firewall allows port 3000
- [ ] Antivirus not blocking port 3000

**Test from PC browser:**
```
http://localhost:3000/api/health  ✅ Should work
http://YOUR_PC_LAN_IP:3000/api/health  ✅ Should work
```

### On Flutter App (Mobile Side)

- [ ] Device on same Wi-Fi as PC (or connected to PC's hotspot)
- [ ] `ApiConfig.baseUrl` uses correct IP:
  - Emulator: `10.0.2.2:3000`
  - Physical device: `YOUR_PC_LAN_IP:3000`
- [ ] App rebuilt after changing `api_config.dart`
- [ ] `android:usesCleartextTraffic="true"` in AndroidManifest ✅
- [ ] Internet permission in AndroidManifest ✅

**Test from phone browser:**
```
http://YOUR_PC_LAN_IP:3000/api/health
```
Should show the same JSON response as on PC.

---

## Common Error Messages & Solutions

### Error: "Failed to connect to /192.168.1.79:3000"

**Cause:** Server not running or wrong IP address

**Fix:**
1. Check server is running
2. Verify PC's current IP hasn't changed
3. Update `api_config.dart` with correct IP
4. Rebuild Flutter app

---

### Error: "Connection refused"

**Cause:** Server not listening on correct port

**Fix:**
1. Check `server/.env` has `API_PORT=3000`
2. Restart server
3. Verify with: `netstat -ano | findstr :3000`

---

### Error: "Network unreachable"

**Cause:** Phone and PC on different networks

**Fix:**
1. Connect phone to same Wi-Fi as PC
2. OR enable PC's mobile hotspot and connect phone to it

---

### Error: "Connection timeout"

**Cause:** Firewall blocking connection

**Fix:**
1. Add firewall rule (see Solution 3)
2. Temporarily disable firewall to test
3. Check antivirus software

---

### Error: "Cleartext HTTP traffic not permitted"

**Cause:** Android blocking HTTP (though you have it configured)

**Fix:** Already solved ✅ - Your AndroidManifest has `usesCleartextTraffic="true"`

---

## Complete Setup Flow

### 1. Start Backend Server

```bash
cd C:\xampp\htdocs\projects\ecotrace_admin\server
npm run dev
```

### 2. Find Your PC's IP

```powershell
ipconfig | Select-String "IPv4.*192.168"
```
Example output: `192.168.1.42`

### 3. Update Flutter App Configuration

**File:** `c:\flutter_workspace\ecotrace\lib\core\config\api_config.dart`

```dart
class ApiConfig {
  static const String baseUrl = 'http://192.168.1.42:3000/api';  // ⬅️ Your PC IP
  
  static const String register = '$baseUrl/auth/register';
  static const String login = '$baseUrl/auth/login';
  static const String profile = '$baseUrl/auth/profile';
  static const String health = '$baseUrl/health';
}
```

### 4. Rebuild Flutter App

```bash
cd c:\flutter_workspace\ecotrace
flutter clean
flutter pub get
flutter run
```

### 5. Test Connection

**From phone browser:**
```
http://192.168.1.42:3000/api/health
```

**From Flutter app:**
- Use health check endpoint
- Try login/register

---

## Server Configuration Reference

**File:** `C:\xampp\htdocs\projects\ecotrace_admin\server\.env`

```bash
# Server binding
API_HOST=0.0.0.0        # Listen on all network interfaces
API_PORT=3000           # Port number

# Database connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ecotrace_db     # Or ecotrace_v2_test for Flutter app's DB

# Security
JWT_SECRET=add8e250e95ea07f09e8fd03d4d35db0b95a162f70a74b0835d040861a27f28b
JWT_EXPIRES_IN=8h
BCRYPT_ROUNDS=12

# CORS (allows all origins in development)
CORS_ORIGIN=*
```

**Important:** `API_HOST=0.0.0.0` means server accepts connections from:
- ✅ localhost (127.0.0.1)
- ✅ PC's LAN IP (192.168.1.42)
- ✅ Any device on the same network

---

## Quick Diagnostic Commands

Run this on your PC to check everything:

```powershell
# Check if server is running
netstat -ano | findstr :3000

# Get your IP
ipconfig | Select-String "IPv4.*192.168"

# Test server locally
curl http://localhost:3000/api/health

# Test server from LAN IP (replace with your IP)
curl http://192.168.1.42:3000/api/health
```

---

## Related Documentation

- **ARCHITECTURE_OVERVIEW.md** - Complete system architecture
- **DATABASE_CONNECTION_EXPLAINED.md** - How database connections work
- **ADMIN_SETUP.md** - Admin account setup
