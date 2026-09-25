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

branch="$(node --experimental-strip-types ./e2e/create-elevenlabs-branch.ts)"
branch_id="${branch%% *}"
branch_name="${branch#* }"
# The fixtures restore the branch by id; the app under test looks it up by name.
export ELEVENLABS_AGENT_BRANCH_ID="${branch_id}"
export ELEVENLABS_AGENT_BRANCH_NAME="${branch_name}"

echo "[dialogbank e2e] using ElevenLabs branch ${ELEVENLABS_AGENT_BRANCH_NAME} (${ELEVENLABS_AGENT_BRANCH_ID})"
pnpm exec playwright test "$@"
