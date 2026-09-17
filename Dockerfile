FROM node:24.19.0-slim

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && chmod +x ./docker-entrypoint.sh

# Deliberately stays root. This project's dev setup runs on rootless Docker,
# where container uid 0 is transparently remapped to the real host user (the
# whole point of rootless Docker), so root-owned writes into the bind mount
# (.svelte-kit, etc.) already come back owned by the host user correctly. A
# non-root container user instead maps into an unrelated subordinate uid
# range with no access to the bind mount at all — confirmed this breaks
# writes entirely, not just "wrong owner". On classic (rootful) Docker this
# reasoning flips and root-in-container is a real problem; there's no single
# Dockerfile setting correct for both, so this repo's dev flow assumes
# rootless Docker rather than guessing.

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev", "--host"]
