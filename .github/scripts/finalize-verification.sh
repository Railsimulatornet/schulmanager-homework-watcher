#!/usr/bin/env bash
# Authorize publication only when both native jobs verified these archive bytes.
set -Eeuo pipefail
archive="$(realpath "${1:?usage: finalize-verification.sh OCI_ARCHIVE REPORT_DIR}")"
out="${2:?report directory required}"
[[ -s "$archive" && -d "$out" && ! -e "$out/verified.sha256" ]]
source_sha="$(sha256sum "$archive" | cut -d ' ' -f 1)"
for arch in amd64 arm64; do
  receipt="$out/$arch/verified.sha256"
  if [[ ! -s "$receipt" ]] || [[ "$(cat "$receipt")" != "$source_sha" ]]; then
    printf 'Missing or mismatched native %s verification receipt.\n' "$arch" >&2
    exit 1
  fi
done
printf '%s\n' "$source_sha" > "$out/verified.sha256"
