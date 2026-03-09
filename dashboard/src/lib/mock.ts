// Mock data matching the Neon readings schema.
// Used when VITE_USE_MOCK=true or when the API is unreachable.

export type Device = {
	dev_eui: string;
	name: string;
	location: string;
	type: 'sound' | 'refrigerator' | 'air_quality' | 'ambient';
	created_at: string;
};

export type Reading = {
	bucket: string;
	dev_eui: string;
	laeq: number | null;
	lamax: number | null;
	temperature: number | null;
	humidity: number | null;
	pm25: number | null;
	pm10: number | null;
	voc_index: number | null;
	battery: number | null;
	door_open: boolean | null;
};

export type LatestReading = Reading & {
	time: string;
	la: number | null;
};

export const MOCK_DEVICES: Device[] = [
	{
		dev_eui: '24E124743E042952',
		name: 'Ruido Cocina Principal',
		location: 'Cocina Central',
		type: 'sound',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: 'AA11BB22CC33DD44',
		name: 'Refrigerador 1',
		location: 'Área de Refrigeración',
		type: 'refrigerator',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: 'FF55EE44DD33CC22',
		name: 'Calidad del Aire',
		location: 'Área de Cocción',
		type: 'air_quality',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	}
];

/** Generates 24 hours of 5-minute bucketed readings for a device. */
export function generateMockReadings(devEui: string, hours = 24): Reading[] {
	const device = MOCK_DEVICES.find((d) => d.dev_eui === devEui);
	const now = Date.now();
	const bucketMs = 5 * 60 * 1000;
	const count = (hours * 60) / 5;
	const readings: Reading[] = [];

	for (let i = count; i >= 0; i--) {
		const time = new Date(now - i * bucketMs).toISOString();
		const noise = (base: number) => base + (Math.random() - 0.5) * 10;

		if (!device || device.type === 'sound') {
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: noise(62),
				lamax: noise(75),
				temperature: null,
				humidity: null,
				pm25: null,
				pm10: null,
				voc_index: null,
				battery: 85 - i * 0.005,
				door_open: null
			});
		} else if (device.type === 'refrigerator') {
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null,
				lamax: null,
				temperature: noise(4),
				humidity: null,
				pm25: null,
				pm10: null,
				voc_index: null,
				battery: 90 - i * 0.005,
				door_open: Math.random() < 0.02 // 2% chance of door open per bucket
			});
		} else {
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null,
				lamax: null,
				temperature: noise(26),
				humidity: noise(55),
				pm25: noise(12),
				pm10: noise(22),
				voc_index: Math.round(noise(80)),
				battery: 78 - i * 0.005,
				door_open: null
			});
		}
	}

	return readings;
}

export function getMockLatest(): LatestReading[] {
	return MOCK_DEVICES.map((d) => {
		const r = generateMockReadings(d.dev_eui, 1).at(-1)!;
		return { ...r, time: new Date().toISOString(), la: r.laeq ? r.laeq - 3 : null };
	});
}
