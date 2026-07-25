# ---------- build ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# instala deps do monorepo (workspaces)
COPY package.json ./
COPY api/package.json ./api/
COPY web/package.json ./web/
RUN npm install

# copia o código e builda (o build da api já roda prisma generate antes do tsc)
COPY . .
RUN npm run build -w api \
 && npm run build -w web

# ---------- runtime ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api ./api
# frontend buildado é servido como estático pela API
COPY --from=build /app/web/dist ./api/public

WORKDIR /app/api
EXPOSE 4000
CMD ["node", "dist/entry.js"]
