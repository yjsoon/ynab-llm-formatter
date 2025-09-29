import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

function stripQuotes(value?: string) {
  if (!value) {
    return value;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function loadAuthEnvFromFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const contents = fs.readFileSync(envPath, 'utf8');
    const lines = contents.split(/\r?\n/);

    for (const line of lines) {
      if (line.startsWith('AUTH_USERNAME=')) {
        const [, ...parts] = line.split('=');
        const value = parts.join('=').trim();
        if (value) {
          process.env.AUTH_USERNAME = stripQuotes(value);
        }
      }

      if (line.startsWith('AUTH_PASSWORD_HASH=')) {
        const [, ...parts] = line.split('=');
        const value = parts.join('=').trim();
        if (value) {
          process.env.AUTH_PASSWORD_HASH = stripQuotes(value);
        }
      }
    }
  } catch (error) {
    console.warn('Unable to hydrate auth env from .env.local', error);
  }
}

function ensureAuthEnvLoaded() {
  const shouldReloadFromFile = process.env.NODE_ENV !== 'production';
  if (shouldReloadFromFile || !process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD_HASH) {
    loadAuthEnvFromFile();
  }
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  ensureAuthEnvLoaded();

  const expectedUsername = process.env.AUTH_USERNAME;
  const hashedPassword = process.env.AUTH_PASSWORD_HASH;

  if (!expectedUsername || !hashedPassword) {
    console.warn(
      'AUTH_USERNAME or AUTH_PASSWORD_HASH not set in environment variables',
    );
    return false;
  }

  const normalisedUsername = username.trim().toLowerCase();
  const normalisedExpected = expectedUsername.trim().toLowerCase();

  if (normalisedUsername !== normalisedExpected) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('Username mismatch', { normalisedUsername, normalisedExpected });
    }
    return false;
  }

  const passwordMatches = await bcrypt.compare(password, hashedPassword);

  if (!passwordMatches && process.env.NODE_ENV !== 'production') {
    console.info('Password mismatch attempt for user', normalisedUsername);
  }

  return passwordMatches;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
