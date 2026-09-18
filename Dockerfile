# syntax=docker/dockerfile:1
#
# Eén Dockerfile voor elke imprint: de site kies je met --build-arg SITE=<map
# onder sites/>. Engine, widgets, site-code en CSS zijn buildtime-compositie
# (transpilePackages, Tailwind @source) en zitten dus in de image; content
# staat in de database en uploads op een volume. Zie docs/deploy-vps.md.
#
#   docker build --build-arg SITE=imprint -t imprint-site .
#
# Targets:
#   tools   — volledige werkboom + devDependencies, voor db:migrate:pg, db:seed
#             en `npm run user` tegen de productiedatabase (geen site-build).
#   (default) runner — de Next standalone-server van één site.

ARG NODE_IMAGE=node:24-bookworm-slim

# ── deps/tools: npm ci over de hele workspace ───────────────────────────────
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY packages/content-core/package.json packages/content-core/
COPY packages/extension-api/package.json packages/extension-api/
COPY packages/runtime-admin/package.json packages/runtime-admin/
COPY packages/widgets-standard/package.json packages/widgets-standard/
COPY sites/musicbrain/package.json sites/musicbrain/
COPY sites/imprint/package.json sites/imprint/
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev --no-audit --no-fund
COPY . .

# ── builder: next build van één site ────────────────────────────────────────
FROM tools AS builder
ARG SITE
RUN test -n "$SITE" && test -d "sites/$SITE" || (echo "build-arg SITE=<map onder sites/> ontbreekt of bestaat niet" >&2; exit 1)
ENV NEXT_OUTPUT=standalone
# Publieke pagina's zijn SSG: de build leest de ContentStore. Geef de
# database mee als BuildKit-secret (komt niet in de image of de history);
# zonder secret bouwt de site uit sites/<site>/content (file-store).
# Een secret telt niet mee in de cache-sleutel, en de content in de database
# al helemaal niet: BUILD_ID (deploy.sh: tijdstempel) dwingt een verse build af.
ARG BUILD_ID=dev
RUN --mount=type=secret,id=database_url,required=false \
    echo "build $BUILD_ID"; \
    if [ -s /run/secrets/database_url ]; then export DATABASE_URL="$(cat /run/secrets/database_url)"; fi; \
    npm run build --workspace="sites/$SITE"

# ── runner: alleen de standalone-uitvoer ────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ARG SITE
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker zet HOSTNAME op de container-id; de standalone-server bindt daarop.
    HOSTNAME=0.0.0.0 \
    ASSET_ROOT=/data/assets
WORKDIR /app
COPY --from=builder --chown=node:node /app/sites/${SITE}/.next/standalone ./
COPY --from=builder --chown=node:node /app/sites/${SITE}/.next/static ./sites/${SITE}/.next/static
COPY --from=builder --chown=node:node /app/sites/${SITE}/public ./sites/${SITE}/public
# contentDir uit imprint.config.ts (file-store-fallback) — process.cwd()/content.
COPY --from=builder --chown=node:node /app/sites/${SITE}/content ./sites/${SITE}/content
# Eigenaar vóór het volume eroverheen komt: een nieuw named volume neemt die over.
RUN mkdir -p /data/assets && chown node:node /data/assets
USER node
WORKDIR /app/sites/${SITE}
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
