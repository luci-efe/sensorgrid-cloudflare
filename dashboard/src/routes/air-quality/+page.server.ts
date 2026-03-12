import { fetchDevices, fetchReadings } from '$lib/api';
import { error } from '@sveltejs/kit';

export const load = async () => {
	const devices = await fetchDevices();
	const aqDevice = devices.find((d) => d.type === 'air_quality');
	if (!aqDevice) error(404, 'No air quality device found');

	const readings = await fetchReadings(aqDevice.dev_eui, '24 hours', '5 minutes');
	return { device: aqDevice, readings };
};
