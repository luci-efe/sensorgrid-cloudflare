import { fetchDevices, fetchReadings } from '$lib/api';
import { error } from '@sveltejs/kit';

function rangeParams(range: string): { interval: string; bucket: string } {
	if (range === '7d') return { interval: '7 days', bucket: '1 hour' };
	return { interval: '24 hours', bucket: '5 minutes' };
}

export const load = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const { interval, bucket } = rangeParams(range);

	const devices = await fetchDevices();
	const aqDevice = devices.find((d) => d.type === 'air_quality');
	if (!aqDevice) error(404, 'No air quality device found');

	const readings = await fetchReadings(aqDevice.dev_eui, interval, bucket);
	return { device: aqDevice, readings, range };
};
