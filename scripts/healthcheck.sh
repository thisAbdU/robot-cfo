#!/usr/bin/env sh
# Verifies database, LI.FI (blockchain), and AI config via GET /health.
# Usage: BACKEND_HEALTH_URL=http://127.0.0.1:3000/health ./scripts/healthcheck.sh

set -eu

URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:3000/health}"

resp="$(curl -sf "$URL")" || {
  echo "healthcheck: curl failed for $URL" >&2
  exit 1
}

export HEALTH_JSON="$resp"
node <<'NODE'
const raw = process.env.HEALTH_JSON;
let o;
try {
  o = JSON.parse(raw ?? '');
} catch {
  console.error('healthcheck: invalid JSON');
  process.exit(1);
}
const ok =
  o.checks?.database?.ok === true &&
  o.checks?.blockchain?.ok === true &&
  o.checks?.ai?.ok === true;
if (!ok) {
  console.error('healthcheck: degraded —', JSON.stringify(o.checks));
  process.exit(1);
}
NODE

echo "healthcheck: ok ($URL)"
