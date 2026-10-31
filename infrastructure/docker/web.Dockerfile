FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/blockchain/package.json packages/blockchain/package.json
COPY packages/database/package.json packages/database/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_PUBLIC_API_URL=http://localhost:4000
RUN pnpm --filter @chainlens/shared-types build && pnpm --filter @chainlens/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@chainlens/web", "start"]
