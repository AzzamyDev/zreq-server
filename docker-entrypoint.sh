#!/bin/sh
set -e
pnpm exec prisma generate
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  pnpm exec prisma migrate deploy
fi
exec "$@"
