FROM node:24.14.0-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/curriculum/package.json packages/curriculum/package.json
COPY packages/evals/package.json packages/evals/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build:packages && pnpm --filter @codelift/api build

FROM node:24.14.0-bookworm-slim AS production-dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/curriculum/package.json packages/curriculum/package.json
COPY packages/evals/package.json packages/evals/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --prod --frozen-lockfile

FROM node:24.14.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-dependencies --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /app/packages/config/dist ./packages/config/dist
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/packages/curriculum/dist ./packages/curriculum/dist
COPY --from=build --chown=node:node /app/packages/evals/dist ./packages/evals/dist
COPY --from=build --chown=node:node /app/codelift_ai_curriculum_seed_v2_2026.json ./codelift_ai_curriculum_seed_v2_2026.json
COPY --from=build --chown=node:node /app/evals/datasets ./evals/datasets
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
