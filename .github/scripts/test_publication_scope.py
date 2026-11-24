"""Check the real scope caller against immutable local Git push ranges."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import publication_scope as scope


RUNTIME = 'src/scheduler.js'
SCRIPT = Path(scope.__file__).resolve()


def allowed(**changes):
    args = dict(repository=scope.REPOSITORY, ref='refs/heads/main', event='push',
                paths=[RUNTIME], manual_publish=False)
    args.update(changes)
    return scope.publication_allowed(**args)


class ScopeDecisions(unittest.TestCase):
    def test_ci_only_push_never_publishes(self):
        for paths in [[], ['.github/workflows/security-scan.yml'],
                      ['.github/scripts/publication_scope.py'],
                      ['.github/scripts/patch_policy.py', '.github/scripts/test_publication_scope.py']]:
            with self.subTest(paths=paths):
                self.assertFalse(allowed(paths=paths))

    def test_runtime_and_mixed_pushes_keep_publication(self):
        self.assertTrue(allowed())
        self.assertTrue(allowed(paths=[RUNTIME, '.github/scripts/publication_scope.py']))

    def test_missing_or_invalid_path_data_cannot_publish(self):
        for paths in [None, '.github/scripts/test.py', [''], ['../runtime'], ['/runtime'],
                      ['.github/../runtime'], [None], ['runtime\0hidden']]:
            with self.subTest(paths=paths), self.assertRaises(ValueError):
                allowed(paths=paths)

    def test_schedule_and_explicit_manual_publication_are_preserved(self):
        self.assertTrue(allowed(event='schedule', paths=None))
        for value in [True, 'true']:
            with self.subTest(value=value):
                self.assertTrue(allowed(event='workflow_dispatch', paths=None, manual_publish=value))
        for value in [False, 'false', None, 1, 'yes']:
            with self.subTest(value=value):
                self.assertFalse(allowed(event='workflow_dispatch', paths=None, manual_publish=value))

    def test_untrusted_and_nonpublishing_contexts_remain_closed(self):
        for event in ['pull_request', 'pull_request_target', 'workflow_run', 'unknown']:
            self.assertFalse(allowed(event=event, paths=None, manual_publish=True))
        self.assertFalse(allowed(repository='fixture/fork', paths=None))
        self.assertFalse(allowed(ref='refs/heads/feature', paths=None))
        self.assertFalse(allowed(ref='refs/tags/v1.0.1', paths=None))


class ImmutablePushHistory(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '--quiet', '--initial-branch=main')
        self.write(RUNTIME, 'initial runtime\n')
        self.base = self.commit()
        self.write(RUNTIME, 'updated runtime\n')
        self.middle = self.commit()
        self.write('.github/scripts/publication_scope.py', 'CI fixture\n')
        self.head = self.commit()

    def git(self, *args):
        return subprocess.run(['git', '-c', 'user.name=Test', '-c',
                               'user.email=test@example.invalid', *args], cwd=self.root,
                              check=True, capture_output=True, text=True).stdout.strip()

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def commit(self):
        self.git('add', '--all')
        self.git('commit', '--quiet', '-m', 'Fixture')
        return self.git('rev-parse', 'HEAD')

    def paths(self, before, after=None):
        head = after or self.head
        return scope.changed_paths(before, head, head, cwd=self.root)

    def test_complete_push_range_keeps_an_earlier_runtime_commit(self):
        paths = self.paths(self.base)
        self.assertEqual(set(paths), {RUNTIME, '.github/scripts/publication_scope.py'})
        self.assertTrue(scope.has_publication_changes(paths))
        self.assertFalse(scope.has_publication_changes(self.paths(self.middle)))

    def test_ci_rename_and_delete_remain_internal(self):
        before = self.head
        source = self.root / '.github/scripts/publication_scope.py'
        renamed = self.root / '.github/scripts/renamed.py'
        source.rename(renamed)
        self.head = self.commit()
        self.assertFalse(scope.has_publication_changes(self.paths(before)))
        before = self.head
        renamed.unlink()
        self.head = self.commit()
        self.assertFalse(scope.has_publication_changes(self.paths(before)))

    def test_runtime_rename_into_ci_retains_the_deleted_runtime_input(self):
        before = self.head
        (self.root / RUNTIME).rename(self.root / '.github/scripts/previous-runtime')
        self.head = self.commit()
        paths = self.paths(before)
        self.assertIn(RUNTIME, paths)
        self.assertTrue(scope.has_publication_changes(paths))

    def test_unknown_base_or_foreign_head_fails_closed(self):
        for before in [None, '', 'main', '0' * 40]:
            with self.subTest(before=before), self.assertRaises(ValueError):
                self.paths(before)
        with self.assertRaises(subprocess.CalledProcessError):
            self.paths('f' * 40)
        with self.assertRaises(ValueError):
            self.paths(self.git('rev-parse', 'HEAD^{tree}'))
        with self.assertRaises(ValueError):
            scope.changed_paths(self.base, self.middle, self.head, cwd=self.root)
        with self.assertRaises(ValueError):
            scope.changed_paths(self.base, self.middle, self.middle, cwd=self.root)

    def run_caller(self, before, event_name='push', inputs=None):
        event = self.root / 'event.json'
        event.write_text(json.dumps({'before': before, 'after': self.head, 'inputs': inputs or {}}))
        output = self.root / 'output'
        output.unlink(missing_ok=True)
        env = {'PATH': os.defpath, 'GITHUB_REPOSITORY': scope.REPOSITORY,
               'GITHUB_EVENT_NAME': event_name, 'GITHUB_REF': 'refs/heads/main',
               'GITHUB_SHA': self.head, 'GITHUB_EVENT_PATH': str(event),
               'GITHUB_OUTPUT': str(output)}
        result = subprocess.run([sys.executable, str(SCRIPT)], cwd=self.root, env=env,
                                capture_output=True, text=True, timeout=15)
        values = dict(line.split('=', 1) for line in output.read_text().splitlines()) if output.exists() else {}
        return result, values

    def test_real_caller_suppresses_ci_only(self):
        result, values = self.run_caller(self.middle)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values, {'publish': 'false'})

    def test_real_caller_preserves_mixed_publication(self):
        result, values = self.run_caller(self.base)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(values, {'publish': 'true'})

    def test_real_caller_stops_on_unknown_history(self):
        result, values = self.run_caller('f' * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(values, {})

    def test_real_caller_respects_manual_opt_in_and_schedule(self):
        for event, inputs, expected in [('workflow_dispatch', {}, 'false'),
                                        ('workflow_dispatch', {'publish': 'false'}, 'false'),
                                        ('workflow_dispatch', {'publish': 'true'}, 'true'),
                                        ('workflow_dispatch', {'publish': True}, 'true'),
                                        ('schedule', {}, 'true')]:
            with self.subTest(event=event, inputs=inputs):
                result, values = self.run_caller(None, event_name=event, inputs=inputs)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(values, {'publish': expected})


if __name__ == '__main__':
    unittest.main()
