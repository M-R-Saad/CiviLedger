# CiviLedger backend — Express API + Sequelize migrations run at container start.
FROM node:20-alpine

WORKDIR /app

# System deps: nc (wait-for-postgres) is in busybox already; nothing extra needed.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD wget -q -O- http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
