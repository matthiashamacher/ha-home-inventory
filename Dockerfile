ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.1
FROM ${BUILD_FROM}

ENV LANG C.UTF-8

# Install nodejs, npm, sqlite3
RUN apk add --no-cache \
    nodejs \
    npm \
    sqlite

# Create app directory
WORKDIR /app

# Copy application files
COPY package.json ./
RUN npm install --omit=dev

COPY server.js run.sh ./
COPY public ./public

# Make run.sh executable
RUN chmod a+x /app/run.sh

# Entrypoint for Home Assistant Add-on
CMD [ "/app/run.sh" ]
