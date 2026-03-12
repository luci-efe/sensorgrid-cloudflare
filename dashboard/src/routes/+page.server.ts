import { fetchDevices, fetchLatest, fetchReadings } from '$lib/api';
import type { Reading } from '$lib/mock';

export const load = async () => {
	const [devices, latest] = await Promise.all([fetchDevices(), fetchLatest()]);

	// Fetch sparkline data (last 2h) for refrigerators
	const fridges = devices.filter((d) => d.type === 'refrigerator');
	const fridgeReadingsArr = await Promise.all(
		fridges.map((f) => fetchReadings(f.dev_eui, '24 hours', '5 minutes'))
	);
	const fridgeReadings: Record<string, Reading[]> = {};
	fridges.forEach((f, i) => {
		fridgeReadings[f.dev_eui] = fridgeReadingsArr[i];
	});

	return { devices, latest, fridgeReadings };
};
