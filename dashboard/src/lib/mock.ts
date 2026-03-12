// Mock data matching the Neon readings schema.
// Used when VITE_USE_MOCK=true or when the API is unreachable.

export type Device = {
	dev_eui: string;
	name: string;
	location: string;
	type: 'sound' | 'refrigerator' | 'air_quality' | 'ambient' | 'power';
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
		dev_eui: 'BB00CC11DD22EE33',
		name: 'Refrigerador 1 — Lácteos',
		location: 'Área de Refrigeración',
		type: 'refrigerator',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: 'CC11DD22EE33FF44',
		name: 'Refrigerador 2 — Carnes',
		location: 'Área de Refrigeración',
		type: 'refrigerator',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	},
	{
		dev_eui: 'DD22EE33FF445566',
		name: 'Refrigerador 3 — Verduras',
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
	},
	{
		dev_eui: '24E124746F133707',
		name: 'Sensor de Corriente 1',
		location: 'Cocina Central',
		type: 'power',
		created_at: new Date(Date.now() - 7 * 86400000).toISOString()
	}
];

/** Generates 24 hours of 5-minute bucketed readings for a device. */
export function generateMockReadings(devEui: string, hours = 24): Reading[] {
	const device = MOCK_DEVICES.find((d) => d.dev_eui === devEui);
	const now = Date.now();
	const bucketMs = 5 * 60 * 1000;
	const count = Math.round((hours * 60) / 5);
	const readings: Reading[] = [];

	// For refrigerators: pick a random door-open event (3 consecutive buckets once per simulation)
	const doorEventStart = Math.floor(Math.random() * Math.max(count - 10, 1));

	// Base battery varies by device for realism
	const baseBattery =
		devEui === 'BB00CC11DD22EE33' ? 90 : devEui === 'CC11DD22EE33FF44' ? 85 : devEui === 'DD22EE33FF445566' ? 88 : 85;

	for (let i = count; i >= 0; i--) {
		const time = new Date(now - i * bucketMs).toISOString();
		const arrayIndex = count - i;
		const noise = (base: number, spread = 5) => base + (Math.random() - 0.5) * spread;

		if (!device || device.type === 'sound') {
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: noise(62, 10),
				lamax: noise(75, 8),
				temperature: null,
				humidity: null,
				pm25: null,
				pm10: null,
				voc_index: null,
				current: null,
				total_current: null,
				battery: baseBattery - arrayIndex * 0.005,
				door_open: null
			});
		} else if (device.type === 'power') {
			// Current: baseline 0.8 A total, spikes during cooking hours
			const date = new Date(time);
			const hour = date.getHours();
			const isCookingHour =
				(hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
			const load = isCookingHour ? noise(4.5, 1.5) : noise(0.8, 0.3);
			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null,
				lamax: null,
				temperature: null,
				humidity: null,
				pm25: null,
				pm10: null,
				voc_index: null,
				current: Math.max(0, noise(load * 0.4, 0.1)),
				total_current: Math.max(0, load),
				battery: baseBattery - arrayIndex * 0.005,
				door_open: null
			});
		} else if (device.type === 'refrigerator') {
			// Temperature: realistic cold chain 2–6°C with slow oscillation
			const tempBase = 3.5 + Math.sin(arrayIndex / 25) * 1.2;
			const temp = tempBase + (Math.random() - 0.5) * 0.8;

			// Door open: 3 consecutive buckets once per day
			const doorOpen = arrayIndex >= doorEventStart && arrayIndex < doorEventStart + 3;

			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null,
				lamax: null,
				temperature: Math.max(1, Math.min(8, temp)),
				humidity: 65 + (Math.random() - 0.5) * 14,
				pm25: null,
				pm10: null,
				voc_index: null,
				current: null,
				total_current: null,
				battery: baseBattery - arrayIndex * 0.005,
				door_open: doorOpen
			});
		} else {
			// Air quality: PM spikes during cooking hours
			const date = new Date(time);
			const hour = date.getHours();
			const isCookingHour =
				(hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
			const pmMultiplier = isCookingHour ? 3.5 + Math.random() * 1.5 : 1;
			const vocMultiplier = isCookingHour ? 2.5 + Math.random() * 1.0 : 1;

			readings.push({
				bucket: time,
				dev_eui: devEui,
				laeq: null,
				lamax: null,
				temperature: noise(26, 3),
				humidity: noise(55, 10),
				pm25: Math.max(2, noise(8, 3) * pmMultiplier),
				pm10: Math.max(4, noise(15, 5) * pmMultiplier),
				voc_index: Math.round(Math.max(30, noise(70, 20) * vocMultiplier)),
				current: null,
				total_current: null,
				battery: baseBattery - arrayIndex * 0.005,
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
