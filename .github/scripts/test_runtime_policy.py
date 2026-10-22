"""Exercise the actual runtime security assertions, without Docker or app credentials."""
import json
from pathlib import Path
import subprocess
import unittest

SCRIPT = Path(__file__).with_name('dependency-smoke-test.js')


class RuntimePolicyTests(unittest.TestCase):
    def run_assertion(self, name, value):
        command = 'require(process.argv[1])[process.argv[2]](JSON.parse(process.argv[3]));'
        return subprocess.run(
            ['node', '-e', command, str(SCRIPT), name, json.dumps(value)],
            capture_output=True, text=True, timeout=10)

    def test_vulnerable_or_unreviewed_node_versions_are_rejected(self):
        for version in ('24.19.0', '24.21.99', '24.22.0', '22.23.4', '25.0.0',
                        '26.12.1', '24.22.1-rc.1', '24.22', 'v24.22.1', ''):
            with self.subTest(version=version):
                result = self.run_assertion('assertSupportedNode', version)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Node.js 24.22.1 or newer within Node 24 is required', result.stderr)

    def test_fixed_and_newer_stable_node_24_versions_are_accepted(self):
        for version in ('24.22.1', '24.22.2', '24.23.0', '24.100.0'):
            with self.subTest(version=version):
                result = self.run_assertion('assertSupportedNode', version)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_both_unused_codec_packages_block_including_architecture_qualified_names(self):
        for package in ('gstreamer1.0-plugins-bad', 'libgstreamer-plugins-bad1.0-0'):
            for suffix in ('', ':amd64', ':arm64'):
                for status in ('installed', 'unpacked', 'half-configured'):
                    with self.subTest(package=package, suffix=suffix, status=status):
                        result = self.run_assertion('assertUnusedCodecsAbsent',
                                                    f'{package}{suffix}\t{status}\n')
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn('Unused WebKit codec package must be removed', result.stderr)

    def test_required_libraries_and_removed_packages_are_accepted(self):
        package_status = ('libgstreamer1.0-0:arm64\tinstalled\n'
                          'libnss3:amd64\tinstalled\n'
                          'gstreamer1.0-plugins-bad\tnot-installed\n'
                          'libgstreamer-plugins-bad1.0-0:amd64\tconfig-files\n')
        result = self.run_assertion('assertUnusedCodecsAbsent', package_status)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
