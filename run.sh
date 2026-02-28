#!/usr/bin/env bashio

if ! bashio::fs.directory_exists '/data'; then
    mkdir -p /data
fi

bashio::log.info "Starting Home Inventory Application"

cd /app
node server.js
