# Admin Account Setup Guide

## Current Status
❌ **No admin account exists in the database**

## Quick Setup (3 steps)

### Step 1: Open phpMyAdmin
1. Start XAMPP (Apache + MySQL)
2. Open browser: `http://localhost/phpmyadmin`
3. Select your database (e.g., `ecotrace_v2_test`)

### Step 2: Run the SQL Script
1. Click the **SQL** tab in phpMyAdmin
2. Open the file: `create-admin-user.sql` (in this folder)
3. Copy all SQL content and paste into the SQL query box
4. Click **Go** to execute

### Step 3: Login to Admin Portal
**URL:** `http://localhost:8443` (or your Vite dev server URL)

**Default Credentials:**
- **Email:** `admin@ecotrace.local`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Change the password immediately after first login!

---

## What the Script Does

The `create-admin-user.sql` script will:
1. ✅ Verify the admin role exists
2. ✅ Create an admin user with bcrypt-hashed password
3. ✅ Display the created user details

---

## Database Details

**Users Table Structure:**
- `role_id: 1` = admin role
- `username: admin`
- `staff_code: ADMIN-001`
- `email: admin@ecotrace.local`
- `password_hash:` bcrypt hash of "admin123"
- `status: active`

---

## Troubleshooting

### Error: Duplicate entry for email
**Solution:** An admin user already exists. To reset password:
```sql
UPDATE users 
SET password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGj4S9YpSYMBdlpDYa'
WHERE email = 'admin@ecotrace.local';
```

### Error: Cannot find role_id
**Solution:** Make sure you imported `schema_v2.sql` first. Run:
```sql
SELECT * FROM roles;
```
You should see: admin (id: 1), officer (id: 2), volunteer (id: 3)

### Login fails with "Invalid credentials"
**Possible causes:**
1. Backend is not using bcrypt (check backend authentication code)
2. Database connection issue
3. Wrong database selected

---

## Changing Password Later

### Method 1: Generate new bcrypt hash online
1. Visit: https://bcrypt-generator.com/
2. Enter your new password
3. Copy the bcrypt hash (rounds: 10)
4. Update database:
```sql
UPDATE users 
SET password_hash = 'YOUR_NEW_BCRYPT_HASH_HERE'
WHERE email = 'admin@ecotrace.local';
```

### Method 2: Use Node.js (requires bcrypt)
```bash
npm install bcrypt
node -e "console.log(require('bcrypt').hashSync('yournewpassword', 10))"
```

---

## Security Notes

1. 🔒 Never store passwords in plain text
2. 🔒 Always use bcrypt with salt rounds ≥ 10
3. 🔒 Change default password immediately
4. 🔒 Use strong passwords in production
5. 🔒 Never commit passwords or hashes to git

---

## Next Steps

After creating the admin account:
1. ✅ Login to admin portal
2. ✅ Change default password
3. ✅ Test dashboard access
4. ✅ Configure other admin settings
5. ✅ Create additional users as needed

---

**Need Help?** Check the backend authentication code to verify it uses bcrypt for password comparison.
