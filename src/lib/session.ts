import type { SessionOptions } from "iron-session";

export interface CustomerSession {
  sub: string;
  name: string;
  email?: string;
  phone?: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SIGNICAT_SESSION_SECRET as string,
  cookieName: "gp-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
  },
};
