// Mock data matching the Neon readings schema.
// Used when VITE_USE_MOCK=true or when the API is unreachable.

export type Device = {
	dev_eui: string;
	name: string;
	location: string;
	type: 'sound' | 'refrigerator' | 'air_quality' | 'ambient' | 'power';
	fridge_label: string | null;
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
	current: number | null;
	total_current: number | null;
	battery: number | null;
	door_open: boolean | null;
	co2: number | null;
	tvoc: number | null;
	pressure: number | null;
	light_level: number | null;
	pir: boolean | null;
};

export type LatestReading = Reading & {
	time: string;
	la: number | null;
};

// Real sensors (Fridge 1)
const AM307_F1 = '24E124707E331131';
const CT101_F1 = '24E124746F133707';
// Mock sensors (Fridge 2 — to simulate inactive CT101)
const AM307_F2 = 'MOCK_AM307_F2_0001';
const CT101_F2 = 'MOCK_CT101_F2_0002'; // will be simulated inactive

export const MOCK_DEVICES: Device[] = [
	{
		dev_eui: AM307_F1,
		name: 'Sensor 7-en-1 Ref. 1',
		location: 'Área de Refrigeración',
		type: 'ambient',
		fridge_label: 'Refrigerador 1',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: CT101_F1,
		name: 'Sensor Corriente Ref. 1',
		location: 'Área de Refrigeración',
		type: 'power',
		fridge_label: 'Refrigerador 1',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: AM307_F2,
		name: 'Sensor 7-en-1 Ref. 2',
		location: 'Refrigerador 2 — Carnes',
		type: 'ambient',
		fridge_label: 'Refrigerador 2 — Carnes',
		created_at: new Date(Date.now() - 3 * 86400000).toISOString()
	},
	{
		dev_eui: CT101_F2,
		name: 'Sensor Corriente Ref. 2',
		location: 'Refrigerador 2 — Carnes',
		type: 'power',
		fridge_label: 'Refrigerador 2 — Carnes',
		created_at: new Date(Date.now() - 3 * 86400000).toISOString()
	},
	{
		dev_eui: 'FF55EE44DD33CC22',
		name: 'Calidad del Aire — Cocina',
		location: 'Área de Cocción',
		type: 'air_quality',
		fridge_label: null,
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	}
];

/** Returns true for AM307/ambient devices (inside fridge). */
function isInsideFridge(devEui: string): boolean {
	return devEui === AM307_F1 || devEui === AM307_F2;
}

/** Generates bucketed readings for a device over a given number of hours. */
export function generateMockReadings(devEui: string, hours = 24, bucketMinutes = 5): Reading[] {
	const device = MOCK_DEVICES.find((d) => d.dev_eui === devEui);
	const now = Date.now();
	const bucketMs = bucketMinutes * 60 * 1000;
	const count = Math.round((hours * 60) / bucketMinutes);
	const readings: Reading[] = [];

	const baseBattery = devEui === AM307_F1 ? 93 : devEui === AM307_F2 ? 76 : 85;
	const noise = (base: number, spread = 1) => base + (Math.random() - 0.5) * spread * 2;

	for (let i = count; i >= 0; i--) {
		const time = new Date(now - i * bucketMs).toISOString();
		const idx = count - i;

		// Door open: ~every 28 buckets (=2.3h at 5min), lasts 2 buckets
		const doorCycle = idx % 28;
		const doorOpen = doorCycle >= 26;

		if (device?.type === 'ambient' && isInsideFridge(devEui)) {
			// AM307 inside refrigerator
			const tempBase = 3.0 + Math.sin(idx / 30) * 0.8;
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null, lamax: null,
				temperature: Math.max(0.5, Math.min(7, tempBase + (doorOpen ? 1.2 : 0) + noise(0, 0.3))),
				humidity: Math.min(95, Math.max(62, 78 + noise(0, 5))),
				pm25: null, pm10: null, voc_index: null,
				current: null, total_current: null,
				battery: Math.max(0, baseBattery - idx * 0.004),
				door_open: null,
				co2: Math.max(400, Math.min(1200, 640 + noise(0, 40) + (doorOpen ? 160 : 0))),
				tvoc: Math.max(0, Math.round(18 + noise(0, 6) + (doorOpen ? 22 : 0))),
				pressure: null,
				light_level: doorOpen ? Math.round(250 + noise(0, 80)) : Math.round(Math.max(0, noise(0, 1.5))),
				pir: null
			});
		} else if (device?.type === 'power') {
			const date = new Date(time);
			const hour = date.getHours();
			const isCooking = (hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
			const load = isCooking ? noise(4.2, 1.0) : noise(0.9, 0.3);
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null, lamax: null,
				temperature: null, humidity: null,
				pm25: null, pm10: null, voc_index: null,
				current: Math.max(0, noise(load * 0.38, 0.08)),
				total_current: Math.max(0, load),
				battery: null, // CT101 has no battery
				door_open: null,
				co2: null, tvoc: null, pressure: null, light_level: null, pir: null
			});
		} else if (device?.type === 'air_quality') {
			const date = new Date(time);
			const hour = date.getHours();
			const isCooking = (hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
			const pmMult = isCooking ? 3.5 + Math.random() * 1.5 : 1;
			const vocMult = isCooking ? 2.5 + Math.random() : 1;
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null, lamax: null,
				temperature: noise(26, 2),
				humidity: noise(55, 8),
				pm25: Math.max(2, noise(8, 2) * pmMult),
				pm10: Math.max(4, noise(15, 4) * pmMult),
				voc_index: Math.round(Math.max(30, noise(70, 15) * vocMult)),
				current: null, total_current: null,
				battery: Math.max(0, baseBattery - idx * 0.004),
				door_open: null,
				co2: null, tvoc: null, pressure: null, light_level: null, pir: null
			});
		} else {
			// fallback
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: noise(62, 8), lamax: noise(75, 6),
				temperature: null, humidity: null,
				pm25: null, pm10: null, voc_index: null,
				current: null, total_current: null,
				battery: Math.max(0, baseBattery - idx * 0.004),
				door_open: null,
				co2: null, tvoc: null, pressure: null, light_level: null, pir: null
			});
		}
	}

	return readings;
}

export function getMockLatest(): LatestReading[] {
	return MOCK_DEVICES.map((d) => {
		const r = generateMockReadings(d.dev_eui, 1).at(-1)!;
		// Simulate CT101_F2 as inactive (last seen 2 hours ago)
		const time = d.dev_eui === CT101_F2
			? new Date(Date.now() - 2 * 3600 * 1000).toISOString()
			: new Date().toISOString();
		return { ...r, time, la: r.laeq ? r.laeq - 3 : null };
	});
}
