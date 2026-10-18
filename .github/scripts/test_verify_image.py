"""Check that both platform scans and runtime tests are required for publication."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

import test_scan_gate as fixtures

SCRIPT = Path(__file__).with_name('verify-image.sh')
SKOPEO_PREFIX = r'''#!/usr/bin/env python3
import hashlib, json, os, pathlib, sys
a = sys.argv[1:]
mode = os.environ['SCENARIO']
def log():
    with open(os.environ['SELECTION_CALLS'], 'a') as out: out.write(json.dumps(a) + '\n')
if 'copy' in a and '--all' in a:
    log()
    if mode == 'transport-failure': sys.exit(9)
    assert '--preserve-digests' in a and a[-2].startswith('oci-archive:')
    destination = pathlib.Path(a[-1].removeprefix('oci:'))
    destination.mkdir()
    for name in ('index.json', 'oci-layout'): (destination / name).write_text('{}')
    sys.exit(0)
if 'copy' in a and a[-1].startswith('docker-daemon:'):
    log()
    arch = a[a.index('--override-arch') + 1]
    config = json.dumps({'os': 'linux', 'architecture': arch}).encode()
    digest = 'sha256:' + hashlib.sha256(config).hexdigest()
    if mode == 'wrong-runtime-image' and arch == 'arm64': digest = 'sha256:' + '0' * 64
    state = pathlib.Path(os.environ['STATE'])
    data = json.loads(state.read_text()) if state.exists() else {}
    data[a[-1].removeprefix('docker-daemon:')] = digest
    state.write_text(json.dumps(data))
    sys.exit(0)
if a[:2] == ['inspect', '--raw'] and (a[-1].startswith('oci-archive:') or a[-1].endswith('/layout')):
    log()
    if mode == 'changed-transport' and a[-1].endswith('/layout'): print('{}')
    else: print('{"schemaVersion":2,"manifests":[{"platform":{"os":"linux","architecture":"amd64"}},{"platform":{"os":"linux","architecture":"arm64"}}]}')
    sys.exit(0)
'''
DOCKER_PREFIX = r'''#!/usr/bin/env python3
import json, os, pathlib, shlex, subprocess, sys
a = sys.argv[1:]
mode = os.environ['SCENARIO']
def log():
    with open(os.environ['CALLS'], 'a') as out: out.write(json.dumps(a) + '\n')
if a[0] == 'pull':
    log()
    sys.exit(9 if mode == 'scanner-pull-failure' else 0)
if a[:2] == ['image', 'inspect']:
    log()
    if a[2] == 'ghcr.io/aquasecurity/trivy:latest':
        print('sha256:' + 'a' * 64)
    else:
        print(json.loads(pathlib.Path(os.environ['STATE']).read_text())[a[2]])
    sys.exit(0)
if a[:2] == ['image', 'rm']:
    log()
    sys.exit(0)
if a[0] == 'run' and '--entrypoint' in a:
    log()
    arch = a[a.index('--platform') + 1].split('/')[1]
    entrypoint = a[a.index('--entrypoint') + 1]
    assert '--network' in a and a[a.index('--network') + 1] == 'none'
    assert a[a.index('--entrypoint') + 2].startswith('sha256:')
    if entrypoint == '/bin/bash':
        # Run the actual syntax-check command against a real JavaScript fixture.
        command = a[-1].replace('/app/src', shlex.quote(os.environ['SOURCE_DIR']))
        sys.exit(subprocess.run(['bash', '-euc', command]).returncode)
    if entrypoint == 'node':
        if mode == 'smoke-' + arch + '-failure': sys.exit(9)
        if mode == 'archive-changed' and arch == 'arm64':
            with open(os.environ['ARCHIVE'], 'ab') as out: out.write(b'changed')
        sys.exit(0)
    sys.exit(2)
'''


class VerificationTests(unittest.TestCase):
    def run_case(self, scenario):
        with tempfile.TemporaryDirectory(prefix='schulmanager verify ') as tmp:
            root = Path(tmp)
            archive = root / 'candidate.tar'
            archive.write_bytes(b'test multiarch artifact')
            sources = root / 'src'
            (sources / 'nested').mkdir(parents=True)
            (sources / 'a-good.js').write_text('const valid = 1;\n')
            (sources / 'nested' / 'b-second.js').write_text(
                'const = ;\n' if scenario == 'syntax-failure' else 'const alsoValid = 2;\n')
            for name, body in (
                ('skopeo', SKOPEO_PREFIX + fixtures.FAKE_SKOPEO),
                ('docker', DOCKER_PREFIX + fixtures.FAKE),
            ):
                tool = root / name
                tool.write_text(body)
                tool.chmod(0o755)
            env = os.environ | {
                'PATH': str(root) + ':' + os.environ['PATH'],
                'SCENARIO': scenario, 'CALLS': str(root / 'calls'),
                'SELECTION_CALLS': str(root / 'selections'), 'STATE': str(root / 'state'),
                'SOURCE_DIR': str(sources), 'ARCHIVE': str(archive),
                'TRIVY_CACHE_DIR': str(root / 'cache'),
            }
            result = subprocess.run(
                ['bash', str(SCRIPT), str(archive), str(root / 'reports')],
                env=env, capture_output=True, text=True, timeout=30)
            calls = [json.loads(x) for x in (root / 'calls').read_text().splitlines()] if (root / 'calls').exists() else []
            stamp = root / 'reports' / 'verified.sha256'
            verified = stamp.read_text().strip() if stamp.exists() else None
            return result, calls, verified, hashlib.sha256(archive.read_bytes()).hexdigest()

    def test_both_platforms_scanned_and_tested_before_archive_is_verified(self):
        result, calls, verified, expected = self.run_case('clean')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(verified, expected)
        scans = [call for call in calls if '--input' in call and '--exit-code' not in call]
        self.assertEqual([call[call.index('--platform') + 1] for call in scans], ['linux/amd64', 'linux/arm64'])
        runtime = [call for call in calls if '--entrypoint' in call]
        self.assertEqual(len(runtime), 4)
        for arch in ('amd64', 'arm64'):
            selected = [call for call in runtime if 'linux/' + arch in call]
            self.assertEqual([call[call.index('--entrypoint') + 1] for call in selected], ['/bin/bash', 'node'])
            for call in selected:
                self.assertTrue(call[call.index('--entrypoint') + 2].startswith('sha256:'))

    def test_any_transport_scan_or_runtime_failure_prevents_verification(self):
        for scenario in (
            'transport-failure', 'changed-transport', 'scanner-pull-failure',
            'scan-error', 'findings', 'eol', 'wrong-runtime-image',
            'smoke-amd64-failure', 'smoke-arm64-failure', 'archive-changed',
        ):
            with self.subTest(scenario=scenario):
                result, _, verified, _ = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIsNone(verified)

    def test_syntax_error_in_second_file_blocks_publication(self):
        result, _, verified, _ = self.run_case('syntax-failure')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('SyntaxError', result.stderr)
        self.assertIsNone(verified)

    def test_original_find_command_did_not_propagate_syntax_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'a-good.js').write_text('const valid = 1;\n')
            (root / 'b-bad.js').write_text('const = ;\n')
            result = subprocess.run(
                ['find', str(root), '-type', 'f', '-name', '*.js', '-print',
                 '-exec', 'node', '--check', '{}', ';'],
                capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0)
            self.assertIn('SyntaxError', result.stderr)


if __name__ == '__main__':
    unittest.main()
