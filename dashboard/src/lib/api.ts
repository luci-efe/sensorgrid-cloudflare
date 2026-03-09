import type { Device, LatestReading, Reading } from './mock';
import { MOCK_DEVICES, generateMockReadings, getMockLatest } from './mock';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

async function get<T>(path: string): Promise<T> {
	const res = await fetch(`${WORKER_URL}${path}`);
	if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
	return res.json();
}

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
	interval = '24 hours',
	bucket = '5 minutes'
): Promise<Reading[]> {
	if (USE_MOCK) return generateMockReadings(devEui);
	const params = new URLSearchParams({ dev_eui: devEui, interval, bucket });
	return get<Reading[]>(`/api/readings?${params}`);
}
