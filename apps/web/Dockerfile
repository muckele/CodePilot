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
RUN pnpm build:packages && pnpm --filter @codelift/web build

FROM nginxinc/nginx-unprivileged:1.29.5-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
USER root
RUN apk upgrade --no-cache \
  && cp /etc/nginx/conf.d/default.conf /tmp/default.runtime.conf \
  && sed -i 's#http://api:4000#http://127.0.0.1:4000#g' /etc/nginx/conf.d/default.conf \
  && nginx -t \
  && rm -f /tmp/nginx.pid \
  && mv /tmp/default.runtime.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
