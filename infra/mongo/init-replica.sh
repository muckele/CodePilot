#!/usr/bin/env bash
set -Eeuo pipefail

mongo_host="${MONGO_HOST:-mongodb}"
mongo_port="${MONGO_PORT:-27017}"
replica_set="${MONGO_REPLICA_SET:-rs0}"
replica_member="${MONGO_REPLICA_MEMBER:-mongodb:27017}"
max_attempts="${MONGO_INIT_MAX_ATTEMPTS:-120}"

if ! [[ "${mongo_port}" =~ ^[0-9]+$ ]] || ! [[ "${max_attempts}" =~ ^[0-9]+$ ]]; then
  echo "Mongo replica initialization received an invalid numeric setting." >&2
  exit 2
fi

echo "Waiting for the local MongoDB process to accept connections."
for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  if mongosh \
    --quiet \
    --host "${mongo_host}" \
    --port "${mongo_port}" \
    --eval 'quit(db.adminCommand({ ping: 1 }).ok === 1 ? 0 : 1)' \
    >/dev/null 2>&1; then
    break
  fi

  if [[ "${attempt}" -eq "${max_attempts}" ]]; then
    echo "MongoDB did not become reachable before the bounded wait expired." >&2
    exit 3
  fi

  sleep 1
done

# Reuse the socket wait above before starting an authenticated shell: the
# official entrypoint may still be starting mongod after a container restart.
if [[ "${MONGO_AUTH_ENABLED:-false}" == "true" ]]; then
  exec mongosh --quiet --host "${mongo_host}" --port "${mongo_port}" \
    /opt/codelift/selfhost/mongo-init.js
fi

mongosh \
  --quiet \
  --host "${mongo_host}" \
  --port "${mongo_port}" \
  --eval '
    const replicaSetName = process.env.MONGO_REPLICA_SET;
    const replicaMember = process.env.MONGO_REPLICA_MEMBER;

    try {
      const existing = rs.conf();
      const expectedConfiguration =
        existing._id === replicaSetName &&
        existing.members.length === 1 &&
        existing.members[0]._id === 0 &&
        existing.members[0].host === replicaMember;

      if (!expectedConfiguration) {
        console.error(
          "MongoDB already has a replica-set configuration that does not match CodeLift M2."
        );
        quit(4);
      }

      print("MongoDB replica set is already configured.");
      quit(0);
    } catch (error) {
      const isUninitialized =
        error.code === 94 || error.codeName === "NotYetInitialized";

      if (!isUninitialized) {
        console.error("MongoDB replica-set state could not be inspected.");
        quit(5);
      }
    }

    const result = rs.initiate({
      _id: replicaSetName,
      members: [{ _id: 0, host: replicaMember }]
    });

    if (result.ok !== 1) {
      console.error("MongoDB replica-set initialization failed.");
      quit(6);
    }

    print("MongoDB replica-set initialization requested.");
  '

echo "Waiting for the MongoDB replica-set member to become writable primary."
for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  if mongosh \
    --quiet \
    --host "${mongo_host}" \
    --port "${mongo_port}" \
    --eval 'quit(db.hello().isWritablePrimary === true ? 0 : 1)' \
    >/dev/null 2>&1; then
    echo "MongoDB replica set ${replica_set} is ready."
    exit 0
  fi

  if [[ "${attempt}" -eq "${max_attempts}" ]]; then
    echo "MongoDB replica set did not elect a primary before the bounded wait expired." >&2
    exit 7
  fi

  sleep 1
done
