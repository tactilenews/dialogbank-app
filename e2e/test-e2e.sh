#!/usr/bin/env bash

set -euo pipefail

branch_id=""

cleanup() {
	if [[ -z "${branch_id}" ]]; then
		return
	fi

	echo "[dialogbank e2e] deleting ElevenLabs branch ${branch_id}"
	node --experimental-strip-types ./e2e/delete-elevenlabs-branch.ts "${branch_id}"
}

trap cleanup EXIT

branch_id="$(node --experimental-strip-types ./e2e/create-elevenlabs-branch.ts)"
export ELEVENLABS_AGENT_BRANCH_ID="${branch_id}"

echo "[dialogbank e2e] using ElevenLabs branch ${ELEVENLABS_AGENT_BRANCH_ID}"
pnpm exec playwright test "$@"
