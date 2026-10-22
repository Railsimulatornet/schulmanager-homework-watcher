FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

LABEL org.opencontainers.image.version="3.0.1"

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Nur Chromium wird verwendet. Nicht benötigte WebKit-Codecs mit CVE-2025-3887 entfernen.
# Keine automatische Entfernung weiterer Browser-Bibliotheken.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get -y purge \
        gstreamer1.0-plugins-bad libgstreamer-plugins-bad1.0-0 \
    && DEBIAN_FRONTEND=noninteractive apt-get -y dist-upgrade \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm ls --omit=dev \
    && npm cache clean --force \
    && rm -rf /root/.npm \
    && rm -rf /usr/lib/node_modules/npm /usr/local/lib/node_modules/npm \
    && rm -f /usr/bin/npm /usr/bin/npx /usr/local/bin/npm /usr/local/bin/npx

COPY src ./src

RUN mkdir -p /app/data/profile /app/data/snapshots /app/data/reports /app/data/state /app/data/mail /app/data/logs \
    && chown -R 1001:10 /app/data \
    && chmod -R 770 /app/data

ENV HOME=/home/pwuser
USER 1001:10

CMD ["node", "src/scheduler.js"]
