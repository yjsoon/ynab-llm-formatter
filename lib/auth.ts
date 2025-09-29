import { getIronSession } from 'iron-session';
import type { NextRequest, NextResponse } from 'next/server';

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
