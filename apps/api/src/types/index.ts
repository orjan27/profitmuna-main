export type Bindings = {
  DB: D1Database;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  APP_BASE_URL: string;
  NODE_ENV: string;
};

// Hono context variable types (c.set / c.get)
export type Variables = {
  userId: number;
};
