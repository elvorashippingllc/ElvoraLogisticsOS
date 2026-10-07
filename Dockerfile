FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
# Chromium renders server-side PDFs (invoices, statements); fonts cover Arabic.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ chromium fonts-noto-core fonts-noto-ui-core fonts-liberation && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production DATA_DIR=/data PORT=8080 CHROME_PATH=/usr/bin/chromium PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package*.json ./
RUN npm ci --omit=dev && apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data /app
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server/index.mjs"]
