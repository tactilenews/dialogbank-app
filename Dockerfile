FROM node:24.19.0-slim

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && chmod +x ./docker-entrypoint.sh

# node:*-slim images ship a preexisting non-root "node" user (uid/gid 1000,
# the common default for a single-user Linux/WSL install). Without this, the
# process runs as root and writes into the bind-mounted repo (.svelte-kit,
# etc.) come back root-owned on the host.
RUN chown -R node:node /app
USER node

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev", "--host"]
