import crypto from "node:crypto";
import { readFileSync } from "node:fs";

const DEV_URL = "http://localhost:5173/webhook/elevenlabs/post-call";

const [, , jsonFile] = process.argv;
if (!jsonFile) {
	console.error("Usage: send-elevenlabs-payload <json_file>");
	process.exit(1);
}

const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
if (!secret) {
	console.error("ELEVENLABS_WEBHOOK_SECRET is not set");
	process.exit(1);
}

const body = readFileSync(jsonFile, "utf-8").trim();
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const response = await fetch(DEV_URL, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		"ElevenLabs-Signature": `t=${timestamp},v0=${signature}`,
	},
	body,
});

const text = await response.text();
console.log(`HTTP ${response.status}`);
try {
	console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
	console.log(text);
}

if (!response.ok) process.exit(1);
