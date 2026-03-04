FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/data/profile /app/data/snapshots /app/data/reports /app/data/state /app/data/mail /app/data/logs

ENV NODE_ENV=production
CMD ["npm", "run", "start"]
