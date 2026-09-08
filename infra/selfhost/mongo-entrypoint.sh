#!/usr/bin/env bash
set -Eeuo pipefail
# Docker Desktop preserves host file ownership. Copy only the member key into
# tmpfs so mongod can read a private 0400 file after the official privilege drop.
install -m 0400 -o mongodb -g mongodb /run/secrets/mongo-keyfile /tmp/mongo-keyfile
# Never let the official _FILE helper export a password or pass it to jq argv.
unset MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD MONGO_INITDB_ROOT_PASSWORD_FILE
if [[ "$1" == "mongod" && ! -e /data/db/WiredTiger && ! -e /data/db/journal && ! -e /data/db/local.0 && ! -e /data/db/storage.bson ]]; then
  chown mongodb:mongodb /data/db
  stop_bootstrap() {
    gosu mongodb mongod --dbpath /data/db --shutdown >/dev/null 2>&1 || true
  }
  trap stop_bootstrap EXIT
  gosu mongodb mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
    --wiredTigerCacheSizeGB 0.5 --logpath /tmp/codelift-bootstrap.log \
    --pidfilepath /tmp/codelift-bootstrap.pid --fork >/dev/null 2>&1
  ready=false
  for ((attempt = 1; attempt <= 120; attempt += 1)); do
    if mongosh --quiet --host 127.0.0.1 --eval 'quit(db.adminCommand({ping:1}).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  if [[ "$ready" != true ]] || ! mongosh --quiet --host 127.0.0.1 \
    /opt/codelift/selfhost/mongo-bootstrap.js >/dev/null 2>&1; then
    echo "MongoDB root bootstrap failed; secret details suppressed." >&2
    exit 1
  fi
  stop_bootstrap
  trap - EXIT
fi
exec /usr/local/bin/docker-entrypoint.sh "$@"
