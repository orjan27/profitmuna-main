// Server-only module — never import from client components.
// Server actions that convert UI whole-number percent → API basis points before
// calling the Workers API.  Auth is forwarded via the access_token cookie.
'use server';

import { cookies } from 'next/headers';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActionResult {
  ok: boolean;
  /** Error message from the API, ready to toast */
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reads the access_token cookie for Bearer auth on server-action fetches. */
async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8793';

/** Parses a failed API response into a human-readable error message. */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? 'Something went wrong. Please try again.';
  } catch {
    return 'Something went wrong. Please try again.';
  }
}

// ── Exported actions ──────────────────────────────────────────────────────────

/**
 * Creates a new Profit Muna account.
 *
 * @param input.targetPercentage - Whole-number percent from the UI (e.g. 5 for 5%).
 *   Converted to basis points (× 100) before sending to the API.
 */
export async function createAccountAction(input: {
  name: string;
  /** Whole-number percent (0–100) */
  targetPercentage: number;
  color: string;
}): Promise<ActionResult> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/profit-muna/accounts`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      ...input,
      // CRITICAL (Pitfall 3): UI works in whole-number percent; API expects basis points.
      targetPercentage: Math.round(input.targetPercentage * 100),
    }),
  });

  if (!res.ok) {
    return { ok: false, message: await extractErrorMessage(res) };
  }
  return { ok: true };
}

/**
 * Updates an existing Profit Muna account.
 *
 * @param input.targetPercentage - Whole-number percent (0–100), converted to bp before send.
 */
export async function updateAccountAction(
  id: number,
  input: {
    name?: string;
    /** Whole-number percent (0–100) */
    targetPercentage?: number;
    color?: string;
  }
): Promise<ActionResult> {
  const token = await getAccessToken();

  // Only convert targetPercentage when it is provided
  const payload: { name?: string; targetPercentage?: number; color?: string } = { ...input };
  if (typeof input.targetPercentage === 'number') {
    // CRITICAL (Pitfall 3): pct → bp
    payload.targetPercentage = Math.round(input.targetPercentage * 100);
  }

  const res = await fetch(`${API_BASE_URL}/api/profit-muna/accounts/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { ok: false, message: await extractErrorMessage(res) };
  }
  return { ok: true };
}

/**
 * Deletes a Profit Muna account (CUSTOM accounts only — server enforces this).
 */
export async function deleteAccountAction(id: number): Promise<ActionResult> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/profit-muna/accounts/${id}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    return { ok: false, message: await extractErrorMessage(res) };
  }
  return { ok: true };
}

/**
 * Bulk-updates allocation percentages for all accounts.
 *
 * @param items - Array of { id, targetPercentage (whole-number percent) }.
 *   Each targetPercentage is converted to basis points before sending.
 *   The total must equal 100% (i.e. sum of bps = 10000); API enforces this.
 */
export async function updatePercentagesAction(
  items: { id: number; targetPercentage: number }[]
): Promise<ActionResult> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE_URL}/api/profit-muna/percentages`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      accounts: items.map((item) => ({
        id: item.id,
        // CRITICAL (Pitfall 3): pct → bp
        targetPercentage: Math.round(item.targetPercentage * 100),
      })),
    }),
  });

  if (!res.ok) {
    return { ok: false, message: await extractErrorMessage(res) };
  }
  return { ok: true };
}
