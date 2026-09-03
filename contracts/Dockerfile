# CiviLedger chain image — serves a local Hardhat node AND runs the deploy/seed
# scripts (same image, different command; see deploy/docker-compose.prod.yml).
FROM node:20-alpine

WORKDIR /contracts

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx hardhat compile

EXPOSE 8545

# Default: run the node. The contracts-deploy service overrides this with the
# deploy + seed commands.
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
