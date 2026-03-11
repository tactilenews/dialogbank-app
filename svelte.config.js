import adapter from "@sveltejs/adapter-netlify";
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		experimental: {
			instrumentation: { server: true },
		},
	},
	preprocess: [mdsvex()],
	extensions: [".svelte", ".svx"],
};

export default config;
