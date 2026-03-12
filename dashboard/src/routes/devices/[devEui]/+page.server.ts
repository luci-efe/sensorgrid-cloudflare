import { fetchDevices, fetchReadings } from '$lib/api';
import { error } from '@sveltejs/kit';

function rangeParams(range: string): { interval: string; bucket: string } {
	if (range === '7d') return { interval: '7 days', bucket: '1 hour' };
	return { interval: '24 hours', bucket: '5 minutes' };
}

export const load = async ({ params, url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const { interval, bucket } = rangeParams(range);

	const [devices, readings] = await Promise.all([
		fetchDevices(),
		fetchReadings(params.devEui, interval, bucket)
	]);

	const device = devices.find((d) => d.dev_eui === params.devEui);
	if (!device) error(404, 'Device not found');

	return { device, readings, range };
};
