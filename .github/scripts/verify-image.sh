#!/usr/bin/env bash
# Test and scan both platforms of the same archive that will be published.
set -Eeuo pipefail
archive="$(realpath "${1:?usage: verify-image.sh OCI_ARCHIVE REPORT_DIR}")"
out="${2:?report directory required}"
[[ -s "$archive" && ! -e "$out/verified.sha256" ]]
mkdir -p "$out"
out="$(realpath "$out")"
scripts="$(cd -- "$(dirname -- "$0")" && pwd)"
work="$(mktemp -d "${RUNNER_TEMP:-/tmp}/schulmanager-verify.XXXXXX")"
trap 'rm -rf -- "$work"' EXIT
source_sha="$(sha256sum "$archive" | cut -d ' ' -f 1)"

# Retain the archive's manifests, attestations and layer digests.
skopeo copy --all --preserve-digests "oci-archive:$archive" "oci:$work/layout"
skopeo inspect --raw "oci-archive:$archive" > "$work/archive.json"
skopeo inspect --raw "oci:$work/layout" > "$work/layout.json"
cmp "$work/archive.json" "$work/layout.json"

docker pull ghcr.io/aquasecurity/trivy:latest
TRIVY_IMAGE="$(docker image inspect ghcr.io/aquasecurity/trivy:latest --format '{{.Id}}')"
[[ "$TRIVY_IMAGE" =~ ^sha256:[a-f0-9]{64}$ ]]
export TRIVY_IMAGE

for arch in amd64 arm64; do
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
done

# Publication accepts only these exact archive bytes after every check passed.
[[ "$(sha256sum "$archive" | cut -d ' ' -f 1)" == "$source_sha" ]]
printf '%s\n' "$source_sha" > "$out/verified.sha256"
