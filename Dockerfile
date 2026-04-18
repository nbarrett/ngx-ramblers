# Multi-stage Dockerfile serving two distinct images from one file:
#
#   --target website (default) - the full NGX Ramblers website app, web only.
#                                 Node 24 base + Mongo tools + gh CLI + flyctl.
#                                 Does NOT ship a browser or JDK - Serenity
#                                 tests + reports run in the --target worker
#                                 image instead.
#   --target worker            - the distributed Serenity upload worker,
#                                 based on the official Serenity/JS Playwright
#                                 image (Node 24 + JDK + Chrome pre-baked).
#                                 See https://serenity-js.org/handbook/integration/docker/
#
# The two stages share no layers (different base images) but live in one file so
# operators can see the full deployment surface at a glance.

# =============================================================================
# Website stage (default target)
# =============================================================================
FROM node:24.14.0 AS website

RUN apt-get update && apt-get install -y wget curl unzip gnupg2 ca-certificates libvips-dev build-essential

RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y gh

ARG MONGOSH_VERSION=2.2.7
ARG DBTOOLS_VERSION=100.9.4
RUN curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg arch=amd64 ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" > /etc/apt/sources.list.d/mongodb-server-7.0.list \
  && apt-get update \
  && apt-get install -y mongodb-mongosh mongodb-database-tools \
  && mongosh --version \
  && mongodump --version \
  && mongorestore --version

RUN curl -fsSL https://fly.io/install.sh | FLYCTL_INSTALL=/usr/local sh \
  && ln -sf /usr/local/bin/flyctl /usr/bin/flyctl \
  && flyctl version

WORKDIR /usr/src/app

COPY package*.json ./
COPY .npmrc ./
COPY fly.toml ./
COPY angular.json ./
COPY ts*.json ./
COPY tools /usr/src/app/tools
COPY projects/ngx-ramblers /usr/src/app/projects/ngx-ramblers

RUN npm ci

RUN npx ng build --project ngx-ramblers --progress --configuration production

WORKDIR /usr/src/app/server

COPY server/package*.json ./
COPY server/ts*.json ./
COPY server/lib* ./
COPY server/.mocharc.json ./
COPY server/playwright.config.ts ./
COPY server /usr/src/app/server

RUN npm install --include=optional sharp
RUN npm ci

EXPOSE 5001

WORKDIR /usr/src/app

CMD ["npm", "run", "server", "--prefix", "server"]

# =============================================================================
# Worker stage (Ramblers upload worker - Serenity/JS Playwright base)
# =============================================================================
FROM --platform=linux/amd64 ghcr.io/serenity-js/playwright:v1.58.1-noble AS worker

ARG NODE_VERSION=24.14.0
ARG NPM_VERSION=11.9.0

USER root

RUN npm install -g n \
  && n ${NODE_VERSION} \
  && npm install -g npm@${NPM_VERSION}

WORKDIR /usr/src/app

COPY package*.json ./
COPY .npmrc ./
COPY angular.json ./
COPY ts*.json ./
COPY fly.toml ./
COPY fly.integration-worker.toml ./
COPY tools /usr/src/app/tools

COPY projects/ngx-ramblers /usr/src/app/projects/ngx-ramblers

RUN npm ci

COPY server /usr/src/app/server
WORKDIR /usr/src/app/server

RUN npm ci

RUN npm run serenity-bdd-update

EXPOSE 5001

WORKDIR /usr/src/app

CMD ["npm", "run", "worker-server", "--prefix", "server"]
