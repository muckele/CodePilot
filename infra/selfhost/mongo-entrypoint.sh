#!/usr/bin/env bash
set -Eeuo pipefail
# Docker Desktop preserves host file ownership. Copy only the member key into
# tmpfs so mongod can read a private 0400 file after the official privilege drop.
install -m 0400 -o mongodb -g mongodb /run/secrets/mongo-keyfile /tmp/mongo-keyfile
exec /usr/local/bin/docker-entrypoint.sh "$@"
