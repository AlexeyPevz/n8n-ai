#!/usr/bin/env bash
set -euo pipefail

URL="$1"
TIMEOUT="${2:-60}"

echo "Waiting for $URL (timeout ${TIMEOUT}s) ..."
for i in $(seq 1 "$TIMEOUT"); do
  if curl -fsS "$URL" > /dev/null; then
    echo "OK: $URL"
    exit 0
  fi
  sleep 1
done
echo "ERROR: Timeout waiting for $URL"
exit 1

