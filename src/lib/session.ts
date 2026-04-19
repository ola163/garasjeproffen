import type { SessionOptions } from "iron-session";

export const ADMIN_EMAILS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

export interface CustomerSession {
  sub: string;
  name: string;
  email?: string;
  phone?: string;
  isLoggedIn: boolean;
  isAdmin?: boolean;
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
