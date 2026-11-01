FROM oven/bun:1.3.13

WORKDIR /app

# Install workspace dependencies first so code-only changes rebuild quickly.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4101
ENV DATABASE_PATH=/data/taskline.db

VOLUME ["/data"]
EXPOSE 4101

CMD ["bun", "apps/api/src/index.ts"]
