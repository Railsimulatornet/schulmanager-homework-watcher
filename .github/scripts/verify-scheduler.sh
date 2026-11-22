#!/usr/bin/env bash
# Check the real image with production restrictions and no external services.
set -Eeuo pipefail
image="${1:?Image ID required}"
container=""
cleanup() { [[ -z "$container" ]] || docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
container="$(docker run -d --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --tmpfs /tmp:rw,nosuid,nodev,size=32m \
  --tmpfs /app/data:rw,nosuid,nodev,size=32m,uid=1001,gid=10,mode=0770 \
  --env RUN_ON_START=false --env MAIL_ENABLED=false --env 'CRON_SCHEDULE=0 0 1 1 *' \
  --health-interval=1s --health-timeout=5s --health-start-period=0s --health-retries=3 \
  "$image")"
healthy=false
for _ in {1..30}; do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$container")"
  if [[ "$status" == healthy ]]; then healthy=true; break; fi
  [[ "$(docker inspect --format '{{.State.Running}}' "$container")" == true ]]
  sleep 1
done
[[ "$healthy" == true ]] || { docker logs "$container"; exit 1; }
docker exec "$container" node /app/src/healthcheck.js
# The check must reject a missing application heartbeat instead of accepting PID 1.
# Freeze only this disposable scheduler so its 15-second timer cannot recreate
# the file between the two exec calls. The EXIT trap removes the stopped process.
docker kill --signal STOP "$container" >/dev/null
docker exec "$container" node -e 'require("fs").unlinkSync("/tmp/schulmanager-scheduler-health.json")'
if docker exec "$container" node /app/src/healthcheck.js; then
  echo 'Missing scheduler state was incorrectly accepted.' >&2
  exit 1
fi
