import { getIronSession } from 'iron-session';
import type { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export interface SessionData {
  isLoggedIn: boolean;
}

export const sessionOptions = {
  password:
    process.env.SESSION_SECRET || 'complex-password-at-least-32-characters-long',
  cookieName: 'ynab-formatter-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(
  request: NextRequest | Request,
  response: NextResponse | Response,
) {
  return getIronSession<SessionData>(request, response, sessionOptions);
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
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
    return false;
  }

  return bcrypt.compare(password, hashedPassword);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
