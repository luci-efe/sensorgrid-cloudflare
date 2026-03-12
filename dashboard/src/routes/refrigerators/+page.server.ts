import { fetchDevices, fetchReadings } from '$lib/api';

function rangeParams(range: string): { interval: string; bucket: string } {
	if (range === '7d') return { interval: '7 days', bucket: '1 hour' };
	return { interval: '24 hours', bucket: '5 minutes' };
}

export const load = async ({ url }) => {
	const range = url.searchParams.get('range') ?? '24h';
	const { interval, bucket } = rangeParams(range);

	const devices = await fetchDevices();
	const fridges = devices.filter((d) => d.type === 'refrigerator');

	const readingsArr = await Promise.all(
		fridges.map((f) => fetchReadings(f.dev_eui, interval, bucket))
	);

	const readings: Record<string, Awaited<ReturnType<typeof fetchReadings>>> = {};
	fridges.forEach((f, i) => {
		readings[f.dev_eui] = readingsArr[i];
	});

	return { fridges, readings, range };
};
