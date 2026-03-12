import { fetchDevices, fetchLatest, fetchReadings } from '$lib/api';
import type { Device, Reading } from '$lib/mock';

function rangeToParams(range: string): { interval: string; bucket: string } {
	if (range === '30d') return { interval: '30 days', bucket: '4 hours' };
	if (range === '7d')  return { interval: '7 days',  bucket: '1 hour' };
	return                       { interval: '1 day',   bucket: '5 minutes' };
}

export type FridgeGroup = {
	label: string;
	am307: Device | null;
	ct101: Device | null;
	am307Readings: Reading[];
	ct101Readings: Reading[];
};

export const load = async ({ url }) => {
	const range = url.searchParams.get('range') ?? 'hoy';
	const { interval, bucket } = rangeToParams(range);

	const [devices, latest] = await Promise.all([fetchDevices(), fetchLatest()]);

	// Group devices by fridge_label
	const fridgeMap = new Map<string, { am307: Device | null; ct101: Device | null }>();
	for (const d of devices) {
		if (!d.fridge_label) continue;
		if (!fridgeMap.has(d.fridge_label)) {
			fridgeMap.set(d.fridge_label, { am307: null, ct101: null });
		}
		const group = fridgeMap.get(d.fridge_label)!;
		if (d.type === 'ambient') group.am307 = d;
		if (d.type === 'power')   group.ct101 = d;
	}

	// Fetch sparkline readings for each pair in parallel
	const entries = [...fridgeMap.entries()];
	const readingResults = await Promise.all(
		entries.map(([, { am307, ct101 }]) =>
			Promise.all([
				am307 ? fetchReadings(am307.dev_eui, interval, bucket) : Promise.resolve([]),
				ct101 ? fetchReadings(ct101.dev_eui, interval, bucket) : Promise.resolve([]),
			])
		)
	);

	const fridgeGroups: FridgeGroup[] = entries.map(([label, { am307, ct101 }], i) => ({
		label,
		am307,
		ct101,
		am307Readings: readingResults[i][0],
		ct101Readings: readingResults[i][1],
	}));

	return { fridgeGroups, latest, range };
};
