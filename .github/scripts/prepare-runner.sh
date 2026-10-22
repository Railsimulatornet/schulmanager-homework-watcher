#!/usr/bin/env bash
set -euo pipefail

# Only clean disposable GitHub-hosted Linux runners, never a NAS or self-hosted runner.
if [[ "${GITHUB_ACTIONS:-}" != "true" || "${RUNNER_ENVIRONMENT:-}" != "github-hosted" || "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "Runner cleanup is restricted to GitHub-hosted Linux runners." >&2
  exit 1
fi

printf '%s\n' '=== Disk space before runner preparation ==='
df -h /
# This project does not build Android, .NET or Swift applications. Keep Node,
# Docker, the checkout, artifacts and all security tools untouched.
sudo rm -rf -- /usr/local/lib/android /usr/share/dotnet /usr/share/swift
printf '%s\n' '=== Disk space after runner preparation ==='
df -h /
available_kb="$(df -Pk / | awk 'NR == 2 {print $4}')"
if [[ ! "$available_kb" =~ ^[0-9]+$ ]] || (( available_kb < 20 * 1024 * 1024 )); then
  echo "At least 20 GiB free disk space is required for the multi-arch build." >&2
  exit 1
fi
