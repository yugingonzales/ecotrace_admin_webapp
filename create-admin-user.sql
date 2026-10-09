-- Create Admin User for EcoTrace Admin Portal
-- Database: ecotrace_v2_test (or your actual database name)
-- Generated: 2026-10-09

-- Bcrypt hash for password: admin123
-- Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGj4S9YpSYMBdlpDYa

-- First, verify roles table has admin role (should be id: 1)
SELECT * FROM roles WHERE name = 'admin';

-- Insert admin user
INSERT INTO users (
  org_id, role_id, username, staff_code,
  first_name, middle_name, last_name, email,
  password_hash, phone, status
)
VALUES (
  NULL,  -- org_id: NULL for super admin, or use specific org_id
  1,     -- role_id: 1 = admin role
  'admin',
  'ADMIN-001',
  'System',
  NULL,
  'Administrator',
  'admin@ecotrace.local',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGj4S9YpSYMBdlpDYa',  -- bcrypt hash for 'admin123'
  NULL,
  'active'
);

-- Verify the admin user was created
SELECT 
  u.id, u.username, u.staff_code, u.first_name, u.last_name,
  u.email, r.name AS role_name, u.status, u.created_at
FROM users AS u
JOIN roles AS r ON r.id = u.role_id
WHERE u.email = 'admin@ecotrace.local';

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Default credentials:
--    Email: admin@ecotrace.local
--    Password: admin123
--
-- 2. CHANGE THE PASSWORD immediately after first login!
--
-- 3. To generate a new bcrypt hash, use:
--    - Online: https://bcrypt-generator.com/
--    - Node.js: npm install bcrypt && node -e "console.log(require('bcrypt').hashSync('yourpassword', 10))"
--
-- 4. To update password later:
--    UPDATE users 
--    SET password_hash = 'NEW_BCRYPT_HASH_HERE' 
--    WHERE email = 'admin@ecotrace.local';
