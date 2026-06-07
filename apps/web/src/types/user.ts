/** Shape of the authenticated user's profile returned by GET /api/auth/me. */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
}
