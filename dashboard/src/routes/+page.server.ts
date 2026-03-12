import { fetchDevices, fetchLatest, fetchReadings } from '$lib/api';
import type { Reading } from '$lib/mock';

export const load = async () => {
	const [devices, latest] = await Promise.all([fetchDevices(), fetchLatest()]);

	const fridges  = devices.filter((d) => d.type === 'refrigerator');
	const ambients = devices.filter((d) => d.type === 'ambient');
	const powers   = devices.filter((d) => d.type === 'power');

	// Fetch 7-day sparkline data (1h buckets → 168 points) for overview cards
	const [fridgeArr, ambientArr, powerArr] = await Promise.all([
		Promise.all(fridges.map((f) => fetchReadings(f.dev_eui, '7 days', '1 hour'))),
		Promise.all(ambients.map((a) => fetchReadings(a.dev_eui, '7 days', '1 hour'))),
		Promise.all(powers.map((p) => fetchReadings(p.dev_eui, '7 days', '1 hour'))),
	]);

	const fridgeReadings: Record<string, Reading[]> = {};
	fridges.forEach((f, i) => { fridgeReadings[f.dev_eui] = fridgeArr[i]; });

	const ambientReadings: Record<string, Reading[]> = {};
	ambients.forEach((a, i) => { ambientReadings[a.dev_eui] = ambientArr[i]; });

	const powerReadings: Record<string, Reading[]> = {};
	powers.forEach((p, i) => { powerReadings[p.dev_eui] = powerArr[i]; });

	return { devices, latest, fridgeReadings, ambientReadings, powerReadings };
};
