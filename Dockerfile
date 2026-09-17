FROM node:24.19.0-slim

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile

RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev", "--host"]
