import { redirect } from "@sveltejs/kit";
import { getAuth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	const auth = getAuth();
	await auth.api.signOut({
		headers: event.request.headers,
	});
	return redirect(302, "/");
};

export const actions: Actions = {
	default: async (event) => {
		const auth = getAuth();
		await auth.api.signOut({
			headers: event.request.headers,
		});
		return redirect(302, "/");
	},
};
