#!/usr/bin/env bashio

if ! bashio::fs.directory_exists '/data'; then
    mkdir -p /data
fi

if bashio::fs.file_exists '/config/configuration.yaml'; then
    bashio::log.info "Found Home Assistant configuration, will use recorder database."
else
    bashio::log.warning "Home Assistant configuration not found, using local database."
fi

bashio::log.info "Starting Home Inventory Application"

cd /app
node server.js
