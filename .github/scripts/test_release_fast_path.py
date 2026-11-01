"""Fail-closed regression checks for the existing-release CI fast path.

These checks deliberately validate workflow policy, not a simulated deployment.
A genuinely new version must still pass the unchanged multiarch release gates.
"""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / ".github/workflows/github-release.yml"
SECURITY = ROOT / ".github/workflows/security-scan.yml"
GUARD = "steps.release.outputs.exists != 'true'"


class ReleaseFastPathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.release = RELEASE.read_text(encoding="utf-8")
        cls.security = SECURITY.read_text(encoding="utf-8")
        cls.build = cls.release.split("\n  build:\n", 1)[1].split("\n  verify:\n", 1)[0]

    def test_version_checked_before_disk_cleanup_or_install(self):
        metadata = self.build.index("      - name: Read release metadata")
        prepare = self.build.index("      - name: Prepare disk space for multi-arch build")
        tests = self.build.index("      - name: Test watcher source")
        self.assertLess(metadata, prepare)
        self.assertLess(prepare, tests)

    def test_expensive_steps_require_a_new_version(self):
        expensive = (
            "Prepare disk space for multi-arch build",
            "Test watcher source",
            "Check publication helpers",
            "Set up QEMU",
            "Set up Docker Buildx",
            "Build release candidate archive",
            "Upload candidate archive",
        )
        for name in expensive:
            with self.subTest(step=name):
                pattern = (
                    r"(?m)^      - name: " + re.escape(name)
                    + r"\n        if: " + re.escape(GUARD) + r"\n"
                )
                self.assertRegex(self.build, pattern)

    def test_existing_tag_is_verified_not_assumed(self):
        self.assertIn('git ls-remote --exit-code --tags origin "refs/tags/${TAG}"',
                      self.build)
        self.assertIn('[[ "$rc" -eq 2 ]] || exit "$rc"', self.build)
        self.assertIn("echo \"exists=${EXISTS}\"", self.build)

    def test_new_release_keeps_both_architecture_receipts(self):
        self.assertIn("if: needs.build.outputs.exists != 'true'", self.release)
        self.assertIn("arch: amd64", self.release)
        self.assertIn("arch: arm64", self.release)
        self.assertIn("finalize-verification.sh", self.release)
        self.assertIn("publish-image.sh", self.release)

    def test_independent_security_scan_remains_unconditional(self):
        self.assertIn("  push:\n    branches: [main]", self.security)
        self.assertIn("  pull_request:", self.security)
        self.assertIn("npm test", self.security)
        self.assertIn("  trivy:\n    needs: build", self.security)
        self.assertIn("arch: amd64", self.security)
        self.assertIn("arch: arm64", self.security)


if __name__ == "__main__":
    unittest.main()
