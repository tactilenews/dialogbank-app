import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
	await auth.api.signOut({
		headers: event.request.headers,
	});
	return redirect(302, "/");
};

export const actions: Actions = {
	default: async (event) => {
		await auth.api.signOut({
			headers: event.request.headers,
		});
		return redirect(302, "/");
	},
};
