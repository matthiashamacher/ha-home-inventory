ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.1
FROM ${BUILD_FROM}

ENV LANG C.UTF-8

# Install nodejs, npm, and build dependencies for native addons
RUN apk add --no-cache \
    nodejs \
    npm \
    sqlite \
    python3 \
    make \
    g++ \
    mariadb-connector-c-dev \
    postgresql-dev \
    vips-dev

# Create app directory
WORKDIR /app

# Copy application files
COPY package.json ./
RUN npm install --omit=dev

COPY server.js run.sh ./
COPY db ./db
COPY public ./public

# Make run.sh executable
RUN chmod a+x /app/run.sh

# Entrypoint for Home Assistant Add-on
CMD [ "/app/run.sh" ]
