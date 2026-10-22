FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Only Chromium is used. Remove unused WebKit codecs affected by CVE-2025-3887;
# do not autoremove libraries needed by the browsers installed outside APT.
# Refresh Ubuntu packages and the base image's NodeSource Node.js 24 runtime.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get -y purge \
        gstreamer1.0-plugins-bad libgstreamer-plugins-bad1.0-0 \
    && DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm ls --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && rm -rf /usr/lib/node_modules/npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/bin/npm /usr/bin/npx /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src

RUN mkdir -p /app/data/profile /app/data/snapshots /app/data/reports /app/data/state /app/data/mail /app/data/logs

CMD ["node", "src/scheduler.js"]
