#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

GIT_PULL=false
NO_CACHE=false
PRUNE=false
FOLLOW_LOGS=false

usage() {
  cat <<'EOF'
Usage: ./redeploy.sh [options]

Redeploy ZReq stack (MySQL + API) via Docker Compose.

Options:
  -p, --pull       git pull --ff-only before rebuild
  --no-cache       docker compose build without layer cache
  --prune          remove dangling images after deploy
  -l, --logs       follow api container logs after start
  -h, --help       show this help

Examples:
  ./redeploy.sh
  ./redeploy.sh --pull
  ./redeploy.sh --pull --no-cache --prune
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p | --pull)
      GIT_PULL=true
      shift
      ;;
    --no-cache)
      NO_CACHE=true
      shift
      ;;
    --prune)
      PRUNE=true
      shift
      ;;
    -l | --logs)
      FOLLOW_LOGS=true
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found in PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose plugin not available" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Copy from .env.example and configure it first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

API_PORT="${PORT:-3030}"

echo "==> ZReq Docker redeploy"
echo "    API port: ${API_PORT}"

if $GIT_PULL; then
  echo "==> Pulling latest code..."
  git pull --ff-only
fi

echo "==> Stopping containers..."
docker compose down

BUILD_ARGS=()
if $NO_CACHE; then
  BUILD_ARGS+=(--no-cache)
fi

echo "==> Building images..."
docker compose build "${BUILD_ARGS[@]}"

echo "==> Starting containers..."
docker compose up -d

echo "==> Waiting for database..."
for i in $(seq 1 30); do
  if docker compose ps db --format '{{.Health}}' 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 2
done

echo "==> Service status:"
docker compose ps

if docker compose ps api --format '{{.State}}' 2>/dev/null | grep -q running; then
  echo ""
  echo "Deploy complete. API available at http://localhost:${API_PORT}"
else
  echo ""
  echo "Warning: api container may not be running. Check logs:" >&2
  echo "  docker compose logs api" >&2
  exit 1
fi

if $PRUNE; then
  echo "==> Pruning dangling images..."
  docker image prune -f
fi

if $FOLLOW_LOGS; then
  echo "==> Following api logs (Ctrl+C to exit)..."
  docker compose logs -f api
fi
