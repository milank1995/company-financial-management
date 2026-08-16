import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  
  // Clear cookie by setting expiration in the past
  response.cookies.set('session', '', {
    httpOnly: true,
    path: '/',
    expires: new Date(0),
  });

  return response;
}
