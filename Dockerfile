FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ && chown node:node /app
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "dist/server/index.mjs"]
