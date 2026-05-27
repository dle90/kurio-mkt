# Kurio Marketing dashboard — Railway deploy image.
#
# Runs the Express server (src/server/index.js). The fetch scripts shell out as
# child processes from the server, so we only need a single node runtime.
FROM node:20-slim

# tzdata so REPORT_DATE math respects Asia/Ho_Chi_Minh
RUN apt-get update && apt-get install -y --no-install-recommends tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV TZ=Asia/Ho_Chi_Minh
ENV NODE_ENV=production

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# App source
COPY src ./src

# DATA_DIR is where .cache/, data/, out/ live. Default to /data so Railway
# volume can be mounted there. Locally you'd run with DATA_DIR=. (repo root).
ENV DATA_DIR=/data
RUN mkdir -p /data/.cache /data/data /data/out

EXPOSE 3000

CMD ["node", "src/server/index.js"]
