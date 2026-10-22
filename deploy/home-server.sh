#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
compose=(docker compose -f compose.cloudflare.yaml)
action="${1:-up}"
case "$action" in
  up|update)
    token_file="${CLOUDFLARE_TOKEN_FILE:-./.secrets/cloudflared-token}"
    if [[ ! -s "$token_file" ]]; then
      printf '%s\n' 'Create .secrets/cloudflared-token on this server first. See docs/home-server-cloudflare.md.' >&2
      exit 2
    fi
    "${compose[@]}" config --quiet
    "${compose[@]}" build web
    "${compose[@]}" up -d --wait web
    "${compose[@]}" exec -T web wget -q -O - http://127.0.0.1:8080/healthz
    "${compose[@]}" up -d tunnel
    "${compose[@]}" ps
    ;;
  status) "${compose[@]}" ps; "${compose[@]}" exec -T web wget -q -O - http://127.0.0.1:8080/healthz ;;
  logs) "${compose[@]}" logs --tail 80 web ;;
  down) "${compose[@]}" down ;;
  rollback)
    tag="${2:?Pass a previously built image tag}"
    [[ "$tag" =~ ^[a-zA-Z0-9_.-]+$ ]] || exit 2
    docker image inspect "mugong:$tag" --format '{{.Id}}' >/dev/null
    MUGONG_TAG="$tag" "${compose[@]}" up -d --no-build --wait web
    ;;
  *) printf 'Usage: bash deploy/home-server.sh {up|update|status|logs|down|rollback IMAGE_TAG}\n' >&2; exit 2 ;;
esac
