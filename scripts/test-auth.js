/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');

// Test credentials
const username = 'admin';
const password = 'test123';

// Generate hash
const hash = bcrypt.hashSync(password, 10);

console.log('\n=== TEST CREDENTIALS ===\n');
console.log('Username:', username);
console.log('Password:', password);
console.log('\n=== ADD TO .env.local ===\n');
console.log(`AUTH_USERNAME=${username}`);
console.log(`AUTH_PASSWORD_HASH=${hash}`);
console.log(`SESSION_SECRET=test-secret-key-at-least-32-chars-long123456`);
console.log('\n=== VERIFICATION ===');

// Verify it works
const matches = bcrypt.compareSync(password, hash);
console.log('Password verification:', matches ? '✅ SUCCESS' : '❌ FAILED');