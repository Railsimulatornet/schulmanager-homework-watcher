#!/usr/bin/env bash
# Test and scan one platform of the publishable archive on its native runner.
set -Eeuo pipefail
archive="$(realpath "${1:?usage: verify-image.sh OCI_ARCHIVE REPORT_DIR ARCH}")"
out="${2:?report directory required}"
arch="${3:?native architecture required}"
case "$arch" in amd64|arm64) ;; *) exit 2 ;; esac
[[ -s "$archive" && ! -e "$out/verified.sha256" && ! -e "$out/$arch/verified.sha256" ]]
mkdir -p "$out"
out="$(realpath "$out")"
scripts="$(cd -- "$(dirname -- "$0")" && pwd)"
work="$(mktemp -d "${RUNNER_TEMP:-/tmp}/schulmanager-verify.XXXXXX")"
trap 'rm -rf -- "$work"' EXIT
source_sha="$(sha256sum "$archive" | cut -d ' ' -f 1)"

# Chromium cannot reliably launch through QEMU user-mode emulation.
host_arch="$(docker info --format '{{.Architecture}}')"
case "$host_arch" in x86_64|amd64) host_arch=amd64 ;; aarch64|arm64) host_arch=arm64 ;; *) exit 2 ;; esac
if [[ "$host_arch" != "$arch" ]]; then
  printf 'Verification requires native %s Docker; found %s.\n' "$arch" "$host_arch" >&2
  exit 2
fi

# Retain the archive's manifests, attestations and layer digests.
skopeo copy --all --preserve-digests "oci-archive:$archive" "oci:$work/layout"
skopeo inspect --raw "oci-archive:$archive" > "$work/archive.json"
skopeo inspect --raw "oci:$work/layout" > "$work/layout.json"
cmp "$work/archive.json" "$work/layout.json"

docker pull ghcr.io/aquasecurity/trivy:latest
TRIVY_IMAGE="$(docker image inspect ghcr.io/aquasecurity/trivy:latest --format '{{.Id}}')"
[[ "$TRIVY_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]]
export TRIVY_IMAGE

platform="linux/$arch"
bash "$scripts/scan-image.sh" "$work/layout" "$platform" "$out/$arch"
expected="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["Metadata"]["ImageID"])' "$out/$arch/trivy.json")"
runtime="schulmanager-homework-watcher:ci-$arch"
skopeo --override-os linux --override-arch "$arch" copy \
  "oci:$work/layout" "docker-daemon:$runtime"
image_id="$(docker image inspect "$runtime" --format '{{.Id}}')"
[[ "$image_id" == "$expected" ]]

# Pipefail propagates syntax errors from every JavaScript file.
docker run --rm --network none --platform "$platform" \
  --entrypoint /bin/bash "$image_id" -euc '
    set -o pipefail
    find /app/src -type f -name "*.js" -print0 |
      while IFS= read -r -d "" source; do
        node --check "$source"
      done
  '
docker run --rm --network none --platform "$platform" \
  --mount "type=bind,src=$scripts/dependency-smoke-test.js,dst=/app/.dependency-smoke-test.js,readonly" \
  --entrypoint node "$image_id" /app/.dependency-smoke-test.js
docker image rm "$runtime" >/dev/null
printf 'Verified %s: %s\n' "$platform" "$image_id"

# Each native job attests to the same complete multi-architecture archive.
[[ "$(sha256sum "$archive" | cut -d ' ' -f 1)" == "$source_sha" ]]
printf '%s\n' "$source_sha" > "$out/$arch/verified.sha256"
