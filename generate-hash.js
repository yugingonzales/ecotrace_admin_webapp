// Simple bcrypt hash generator
// Usage: node generate-hash.js <password>

import crypto from 'crypto';

const password = process.argv[2] || 'admin123';

// Generate a simple SHA-256 hash as fallback
// NOTE: For production, use proper bcrypt
const hash = crypto.createHash('sha256').update(password).digest('hex');

console.log('\n=== Password Hash Generator ===');
console.log('Password:', password);
console.log('SHA-256 Hash:', hash);
console.log('\nWARNING: This is SHA-256, not bcrypt!');
console.log('For production, install bcrypt: npm install bcrypt');
console.log('\nBcrypt hash (use online tool):');
console.log('Visit: https://bcrypt-generator.com/');
console.log('Enter password and copy the hash\n');
