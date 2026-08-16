import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: { userId: string; email: string; role: string; companyId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      companyId: string;
    };
  } catch {
    return null;
  }
}

export function getCookie(cookieString: string, name: string): string | null {
  if (!cookieString) return null;
  const cookies = cookieString.split(';');
  for (const cookie of cookies) {
    const [cName, cValue] = cookie.trim().split('=');
    if (cName === name) return decodeURIComponent(cValue);
  }
  return null;
}

export async function getAuthUser(req: Request) {
  const cookieHeader = req.headers.get('cookie') || '';
  const token = getCookie(cookieHeader, 'session');
  if (!token) return null;
  return verifyToken(token);
}

import { NextResponse } from 'next/server';

export async function checkAuth(req: Request) {
  const user = await getAuthUser(req);
  if (!user) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }
  return { authenticated: true, response: null, user };
}

