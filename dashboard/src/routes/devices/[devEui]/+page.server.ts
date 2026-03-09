import { fetchDevices, fetchReadings } from '$lib/api';
import { error } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const [devices, readings] = await Promise.all([
		fetchDevices(),
		fetchReadings(params.devEui, '24 hours', '5 minutes')
	]);

	const device = devices.find((d) => d.dev_eui === params.devEui);
	if (!device) error(404, 'Device not found');

	return { device, readings };
};
