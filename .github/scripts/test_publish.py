"""Publication requires the verified archive and preserves its manifest digest."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

SCRIPTS = Path(__file__).parent
REPO = SCRIPTS.parent.parent
IMAGE = 'railsimulatornet/schulmanager-homework-watcher'
FAKE = r'''#!/usr/bin/env python3
import hashlib, json, os, pathlib, sys
a = sys.argv[1:]
mode = os.environ['SCENARIO']
with open(os.environ['CALLS'], 'a') as out: out.write(json.dumps(a) + '\n')
if a[0] == 'login':
    assert sys.stdin.read() == 'fixture-token'
    sys.exit(9 if mode == 'login-error' else 0)
if a[0] == 'manifest-digest':
    if mode == 'invalid-digest': print('invalid')
    else: print('sha256:' + hashlib.sha256(pathlib.Path(a[-1]).read_bytes()).hexdigest())
    sys.exit(0)
if a[0] == 'inspect':
    if mode == 'source-error' and a[-1].startswith('oci-archive:'): sys.exit(9)
    if mode == 'check-error' and a[-1].startswith('docker://'): sys.exit(9)
    digest = 'b' if mode == 'different-remote' and a[-1].startswith('docker://') else 'a'
    print(json.dumps({'schemaVersion': 2, 'manifests': [{'digest': 'sha256:' + digest * 64}]}))
    sys.exit(0)
if a[0] == 'copy':
    assert '--all' in a and '--preserve-digests' in a and a[-2].startswith('oci-archive:')
    sys.exit(9 if mode == 'copy-error' else 0)
sys.exit(2)
'''


class PublishTests(unittest.TestCase):
    def run_case(self, scenario, tags=None):
        with tempfile.TemporaryDirectory(prefix='schulmanager publish ') as tmp:
            root = Path(tmp)
            archive = root / 'image.tar'
            archive.write_bytes(b'verified multiarch archive')
            receipt = root / 'verified.sha256'
            if scenario != 'missing-verification':
                receipt.write_text(
                    'invalid\n' if scenario == 'invalid-verification'
                    else hashlib.sha256(archive.read_bytes()).hexdigest() + '\n')
            if scenario == 'archive-changed':
                archive.write_bytes(b'unverified replacement')
            tool = root / 'skopeo'
            tool.write_text(FAKE)
            tool.chmod(0o755)
            env = os.environ | {
                'PATH': str(root) + ':' + os.environ['PATH'],
                'SCENARIO': scenario, 'CALLS': str(root / 'calls'),
                'DOCKERHUB_USERNAME': 'fixture-user', 'DOCKERHUB_TOKEN': 'fixture-token',
            }
            if scenario == 'missing-credentials':
                env.pop('DOCKERHUB_TOKEN')
            selected = tags if tags is not None else [IMAGE + ':' + tag for tag in ('2.0.5', '2.0', 'latest', '18102026')]
            result = subprocess.run(
                ['bash', str(SCRIPTS / 'publish-image.sh'), str(archive), str(receipt), '\n'.join(selected)],
                env=env, capture_output=True, text=True, timeout=30)
            calls = [json.loads(x) for x in (root / 'calls').read_text().splitlines()] if (root / 'calls').exists() else []
            return result, calls, selected

    def test_original_release_tags_receive_the_same_verified_image(self):
        result, calls, tags = self.run_case('clean')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        copies = [call for call in calls if call[0] == 'copy']
        self.assertEqual([call[-1] for call in copies], ['docker://' + tag for tag in tags])
        self.assertEqual(len({call[-2] for call in copies}), 1)
        self.assertTrue(all('--all' in call and '--preserve-digests' in call for call in copies))
        checks = [call for call in calls if call[0] == 'inspect' and call[-1].startswith('docker://')]
        self.assertEqual([call[-1] for call in checks], ['docker://' + tag for tag in tags])
        self.assertNotIn('fixture-token', json.dumps(calls))

    def test_missing_or_changed_verification_never_contacts_registry(self):
        for scenario in ('missing-verification', 'invalid-verification', 'archive-changed', 'missing-credentials'):
            with self.subTest(scenario=scenario):
                result, calls, _ = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(calls, [])

    def test_unexpected_registry_or_malformed_tag_never_contacts_registry(self):
        for tags in ([IMAGE + ':latest', 'another-owner/image:latest'], [IMAGE + ':bad tag'], []):
            with self.subTest(tags=tags):
                result, calls, _ = self.run_case('clean', tags)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(calls, [])

    def test_source_or_login_errors_prevent_all_publication(self):
        for scenario in ('source-error', 'invalid-digest', 'login-error'):
            with self.subTest(scenario=scenario):
                result, calls, _ = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(call[0] == 'copy' for call in calls))

    def test_transfer_error_or_changed_digest_stops_before_next_tag(self):
        for scenario in ('copy-error', 'check-error', 'different-remote'):
            with self.subTest(scenario=scenario):
                result, calls, _ = self.run_case(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(len([call for call in calls if call[0] == 'copy']), 1)


class ReleaseMetadataTests(unittest.TestCase):
    def run_case(self, git_status):
        workflow = (REPO / '.github/workflows/github-release.yml').read_text()
        block = workflow.split('      - name: Read release metadata\n', 1)[1]
        command = textwrap.dedent(block.split('        run: |\n', 1)[1].split('\n      - name:', 1)[0])
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.github').mkdir()
            (root / 'package.json').write_text('{"version":"2.0.5"}')
            (root / '.github/release-title.txt').write_text('v2.0.5\n')
            (root / '.github/release-notes.md').write_text('v2.0.5\n')
            git = root / 'git'
            git.write_text('#!/bin/sh\nexit ' + str(git_status) + '\n')
            git.chmod(0o755)
            output = root / 'outputs'
            result = subprocess.run(
                ['bash', '-euc', command], cwd=root, capture_output=True, text=True, timeout=30,
                env=os.environ | {'PATH': str(root) + ':' + os.environ['PATH'], 'GITHUB_OUTPUT': str(output)})
            values = dict(line.split('=', 1) for line in output.read_text().splitlines()) if output.exists() else {}
            return result, values

    def test_existing_tag_still_skips_release(self):
        result, values = self.run_case(0)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values['exists'], 'true')
        self.assertEqual((values['version'], values['tag'], values['minor']), ('2.0.5', 'v2.0.5', '2.0'))

    def test_missing_tag_still_allows_new_release(self):
        result, values = self.run_case(2)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values['exists'], 'false')

    def test_remote_lookup_failure_does_not_start_release(self):
        result, values = self.run_case(128)
        self.assertEqual(result.returncode, 128)
        self.assertEqual(values, {})


class ManualMetadataTests(unittest.TestCase):
    def run_case(self, version):
        workflow = (REPO / '.github/workflows/docker-publish.yml').read_text()
        block = workflow.split('      - name: Set build variables\n', 1)[1]
        command = textwrap.dedent(block.split('        run: |\n', 1)[1].split('\n      - name:', 1)[0])
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'environment'
            result = subprocess.run(
                ['bash', '-euc', command], capture_output=True, text=True, timeout=30,
                env=os.environ | {'INPUT_VERSION': version, 'GITHUB_ENV': str(output)})
            values = dict(line.split('=', 1) for line in output.read_text().splitlines()) if output.exists() else {}
            return result, values

    def test_normal_and_prerelease_inputs_are_preserved(self):
        for version in ('2.0.5', 'v2.0.5', 'v2.0.5-rc.1'):
            with self.subTest(version=version):
                result, values = self.run_case(version)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(values['VERSION'], version)
                self.assertRegex(values['DATE_TAG'], r'^\d{8}$')

    def test_empty_or_multiline_input_does_not_change_environment(self):
        for version in ('', 'v2.0.5\nEXTRA=value', 'v2.0.5\rEXTRA=value'):
            with self.subTest(version=version):
                result, values = self.run_case(version)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(values, {})


if __name__ == '__main__':
    unittest.main()
