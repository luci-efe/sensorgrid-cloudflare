import type { Device, LatestReading, Reading } from './mock';
import { MOCK_DEVICES, generateMockReadings, getMockLatest } from './mock';
import { getSessionToken } from './auth';

export const USE_MOCK   = import.meta.env.VITE_USE_MOCK === 'true';
const WORKER_URL        = import.meta.env.VITE_WORKER_URL ?? '';

export class PendingApprovalError extends Error {
  constructor() {
    super('pending_approval');
    this.name = 'PendingApprovalError';
  }
}

async function get<T>(path: string): Promise<T> {
	const token = USE_MOCK ? null : await getSessionToken();
	const headers: Record<string, string> = {};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	const res = await fetch(`${WORKER_URL}${path}`, { headers });
	if (res.status === 403) {
		const body = await res.json().catch(() => ({})) as { code?: string };
		if (body.code === 'pending_approval') throw new PendingApprovalError();
	}
	if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
	return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
	const token = await getSessionToken();
	const res = await fetch(`${WORKER_URL}${path}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`API PATCH ${path} returned ${res.status}`);
	return res.json();
}

export type AlertRule = {
	id: number;
	name: string | null;
	dev_eui: string | null;
	metric: string;
	operator: 'gt' | 'lt' | 'eq';
	threshold: number;
	enabled: boolean;
	email_tier1: string[];
	email_tier2: string[];
	email_tier2_delay_min: number;
	created_at: string;
};

export type AlertEvent = {
	id: number;
	rule_id: number;
	dev_eui: string;
	metric: string;
	value: number;
	triggered_at: string;
	resolved_at: string | null;
	tier1_sent_at: string | null;
	tier2_sent_at: string | null;
	rule_name?: string | null;
};

export type AdminUser = {
	id: string;
	name: string;
	email: string;
	role: string | null;
	emailVerified: boolean;
	createdAt: string;
	approval_status: 'pending' | 'approved' | 'rejected';
	approved_at: string | null;
	rejected_reason: string | null;
};

// ── Device / readings ─────────────────────────────────────────────────────

export async function fetchDevices(): Promise<Device[]> {
	if (USE_MOCK) return MOCK_DEVICES;
	return get<Device[]>('/api/devices');
}

export async function fetchLatest(): Promise<LatestReading[]> {
	if (USE_MOCK) return getMockLatest();
	return get<LatestReading[]>('/api/latest');
}

export async function fetchReadings(
	devEui: string,
	interval = '1 day',
	bucket = '5 minutes',
): Promise<Reading[]> {
	if (USE_MOCK) {
		const hours     = interval.includes('30') ? 720 : interval.includes('7') ? 168 : 24;
		const bucketMin = bucket.includes('4') ? 240 : bucket.includes('hour') ? 60 : 5;
		return generateMockReadings(devEui, hours, bucketMin);
	}
	const params = new URLSearchParams({ dev_eui: devEui, interval, bucket });
	return get<Reading[]>(`/api/readings?${params}`);
}

// ── Alert rules ────────────────────────────────────────────────────────────

export async function fetchAlertRules(): Promise<AlertRule[]> {
	if (USE_MOCK) return [];
	return get<AlertRule[]>('/api/alert-rules');
}

export async function patchAlertRule(id: number, updates: Partial<AlertRule>): Promise<AlertRule> {
	return patch<AlertRule>(`/api/alert-rules/${id}`, updates);
}

// ── Alert events ───────────────────────────────────────────────────────────

export async function fetchAlertEvents(limit = 50): Promise<AlertEvent[]> {
	if (USE_MOCK) return [];
	return get<AlertEvent[]>(`/api/alert-events?limit=${limit}`);
}

// ── Admin ──────────────────────────────────────────────────────────────────

export async function fetchAdminUsers(): Promise<AdminUser[]> {
	return get<AdminUser[]>('/api/admin/users');
}

export async function patchAdminUser(
	id: string,
	updates: { role?: string; approval_status?: string; rejected_reason?: string },
): Promise<AdminUser> {
	return patch<AdminUser>(`/api/admin/users/${id}`, updates);
}

// ── Me ─────────────────────────────────────────────────────────────────────

export async function fetchMe(): Promise<{ userId: string; name: string; email: string; role: string }> {
	if (USE_MOCK) return { userId: 'mock', name: 'Usuario Mock', email: 'mock@example.com', role: 'admin' };
	return get('/api/me');
}
