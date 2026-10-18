#!/usr/bin/env bash
# Publish the verified archive without rebuilding either platform.
set -Eeuo pipefail
archive="$(realpath "${1:?usage: publish-image.sh OCI_ARCHIVE VERIFICATION TAGS}")"
verification="${2:?verification file required}"
tags_text="${3:?Docker tags required}"
[[ -s "$archive" && -s "$verification" ]]
expected_sha="$(cat "$verification")"
[[ "$expected_sha" =~ ^[a-f0-9]{64}$ ]]
[[ "$(sha256sum "$archive" | cut -d ' ' -f 1)" == "$expected_sha" ]]

tags=()
while IFS= read -r tag; do
  [[ -n "$tag" ]] || continue
  [[ "$tag" =~ ^railsimulatornet/schulmanager-homework-watcher:[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127}$ ]] || exit 2
  tags+=("$tag")
done <<< "$tags_text"
[[ ${#tags[@]} -gt 0 ]]
: "${DOCKERHUB_USERNAME:?Docker Hub username required}"
: "${DOCKERHUB_TOKEN:?Docker Hub token required}"
work="$(mktemp -d "${RUNNER_TEMP:-/tmp}/schulmanager-publish.XXXXXX")"
trap 'rm -rf -- "$work"' EXIT
source="oci-archive:$archive"
skopeo inspect --raw "$source" > "$work/source.json"
expected="$(skopeo manifest-digest "$work/source.json")"
[[ "$expected" =~ ^sha256:[a-f0-9]{64}$ ]]
printf '%s' "$DOCKERHUB_TOKEN" | skopeo login --authfile "$work/auth.json" \
  --username "$DOCKERHUB_USERNAME" --password-stdin docker.io

for tag in "${tags[@]}"; do
  skopeo copy --authfile "$work/auth.json" --all --preserve-digests "$source" "docker://$tag"
  skopeo inspect --authfile "$work/auth.json" --raw "docker://$tag" > "$work/published.json"
  [[ "$(skopeo manifest-digest "$work/published.json")" == "$expected" ]]
  printf 'Published verified image: %s\n' "$tag"
done
