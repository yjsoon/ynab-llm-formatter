/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Credentials Generator for YNAB Formatter');
console.log('==========================================\n');

function askUsername() {
  return new Promise((resolve) => {
    rl.question('Enter your username: ', (username) => {
      if (!username || username.length < 3) {
        console.error('\n❌ Username must be at least 3 characters long');
        rl.close();
        process.exit(1);
      }
      resolve(username);
    });
  });
}

function askPassword() {
  return new Promise((resolve) => {
    rl.question('Enter your password: ', (password) => {
      if (!password || password.length < 6) {
        console.error('\n❌ Password must be at least 6 characters long');
        rl.close();
        process.exit(1);
      }
      resolve(password);
    });
  });
}

async function main() {
  try {
    const username = await askUsername();
    const password = await askPassword();

    const hash = await bcrypt.hash(password, 10);

    console.log('\n✅ Credentials generated successfully!\n');
    console.log('Add these lines to your .env.local file:');
    console.log('==========================================');
    console.log(`AUTH_USERNAME=${username}`);
    console.log(`AUTH_PASSWORD_HASH=${hash}`);
    console.log(`SESSION_SECRET=${generateRandomString(32)}`);
    console.log('==========================================\n');
    console.log('⚠️  Keep these values secret and never commit them to git!\n');
  } catch (error) {
    console.error('\n❌ Error generating credentials:', error);
  } finally {
    rl.close();
  }
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

main();