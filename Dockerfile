FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Install available Ubuntu security updates from the base image.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && rm -rf /usr/lib/node_modules/npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/bin/npm /usr/bin/npx /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src

RUN mkdir -p /app/data/profile /app/data/snapshots /app/data/reports /app/data/state /app/data/mail /app/data/logs

ENV NODE_ENV=production

CMD ["node", "src/scheduler.js"]
