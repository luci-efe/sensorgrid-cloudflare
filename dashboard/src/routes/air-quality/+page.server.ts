import { fetchDevices, fetchReadings } from '$lib/api';
import type { Device } from '$lib/mock';

function rangeParams(range: string): { interval: string; bucket: string } {
	if (range === '7d') return { interval: '7 days', bucket: '1 hour' };
	return { interval: '24 hours', bucket: '5 minutes' };
}

export const load = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const { interval, bucket } = rangeParams(range);

	const devices = await fetchDevices();

	// Air quality can come from a dedicated sensor (type=air_quality) or the 7-in-1 (type=ambient)
	const aqDevice: Device | undefined =
		devices.find((d) => d.type === 'air_quality') ?? devices.find((d) => d.type === 'ambient');

	if (!aqDevice) {
		return { device: null, readings: [], range };
	}

	const readings = await fetchReadings(aqDevice.dev_eui, interval, bucket);
	return { device: aqDevice, readings, range };
};
