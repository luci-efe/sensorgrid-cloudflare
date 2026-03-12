import { fetchDevices, fetchReadings } from '$lib/api';

export const load = async () => {
	const devices = await fetchDevices();
	const fridges = devices.filter((d) => d.type === 'refrigerator');

	const readingsArr = await Promise.all(
		fridges.map((f) => fetchReadings(f.dev_eui, '24 hours', '5 minutes'))
	);

	const readings: Record<string, Awaited<ReturnType<typeof fetchReadings>>> = {};
	fridges.forEach((f, i) => {
		readings[f.dev_eui] = readingsArr[i];
	});

	return { fridges, readings };
};
