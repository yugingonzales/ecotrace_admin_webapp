Find the volunteer role ID and create a username-based test user:

```sql
SELECT id, name FROM roles WHERE name = 'volunteer';

INSERT INTO users (
  role_id, username, first_name, middle_name, last_name, email,
  password_hash, phone, status
)
VALUES (
  3, 'test.volunteer', 'Test', NULL, 'Volunteer',
  'test.volunteer@example.com', 'replace-with-a-bcrypt-hash',
  '+63 900 000 0000', 'active'
);
```