import { redirect } from "@sveltejs/kit";
import { withAuthenticatedLoad } from "$lib/server/require-user";
import type { PageServerLoad } from "./$types";

export const load = withAuthenticatedLoad<
	Parameters<PageServerLoad>[0],
	ReturnType<PageServerLoad>
>(async () => {
	throw redirect(302, "/editor/dashboard");
});
