/* eslint-disable @typescript-eslint/no-require-imports */
const bcrypt = require('bcryptjs');
const readline = require('readline');
const crypto = require('crypto');

const isTerminal = process.stdin.isTTY && process.stdout.isTTY;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: isTerminal,
});

const originalWrite = rl._writeToOutput;

function setMaskedOutput(enabled) {
  if (!isTerminal) {
    return;
  }

  if (enabled) {
    rl.stdoutMuted = true;
    rl._writeToOutput = function maskOutput(stringToWrite) {
      if (
        stringToWrite.includes('\n') ||
        stringToWrite.includes('\r') ||
        stringToWrite.includes('\u001b')
      ) {
        originalWrite.call(rl, stringToWrite);
        return;
      }
      if (stringToWrite.includes('\u0008') || stringToWrite.includes('\u007f')) {
        rl.output.write('\b \b');
        return;
      }
      rl.output.write('*');
    };
  } else {
    rl.stdoutMuted = false;
    rl._writeToOutput = originalWrite;
  }
}

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
      resolve(username.trim());
    });
  });
}

function askPassword() {
  return new Promise((resolve) => {
    rl.question('Enter your password: ', (password) => {
      setMaskedOutput(false);
      if (isTerminal) {
        console.log('');
      }
      if (!password || password.length < 6) {
        console.error('\n❌ Password must be at least 6 characters long');
        rl.close();
        process.exit(1);
      }
      resolve(password);
    });
    setMaskedOutput(true);
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
    console.log(`AUTH_PASSWORD_HASH='${hash}'`);
    console.log(`SESSION_SECRET=${generateRandomString(32)}`);
    console.log('==========================================\n');
    console.log('⚠️  Keep these values secret and never commit them to git!');
    console.log('⚠️  Restart your dev server after updating the credentials.\n');
  } catch (error) {
    console.error('\n❌ Error generating credentials:', error);
  } finally {
    setMaskedOutput(false);
    rl.close();
  }
}

function generateRandomString(length) {
  const buffer = crypto.randomBytes(length * 2);
  return buffer
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, length);
}

main();
