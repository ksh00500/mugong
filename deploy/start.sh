#!/bin/sh
set -eu
config=/srv/mugong/nginx.conf
pid_file=/srv/mugong/nginx.pid
# Keep hashed modules from previous releases for tabs already open during deployment.
mkdir -p /srv/mugong/shared/assets
for release in /srv/mugong/releases/*; do
  if [ -d "$release/assets" ]; then
    for asset in "$release"/assets/*; do
      [ -f "$asset" ] || continue
      target="/srv/mugong/shared/assets/${asset##*/}"
      if [ ! -e "$target" ]; then
        cp "$asset" "$target"
      fi
    done
  fi
done
nginx -t -c "$config"
if [ -s "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
  nginx -s reload -c "$config"
else
  nginx -c "$config"
fi
