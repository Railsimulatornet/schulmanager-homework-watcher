"""Keep CI-only pushes out of image publication while preserving verification."""
import json
import os
from pathlib import Path
import re
import subprocess

REPOSITORY = 'Railsimulatornet/schulmanager-homework-watcher'
COMMIT_PATTERN = r'[a-f0-9]{40}'


def changed_paths(before, after, expected_head, *, cwd=None):
    """Read the complete immutable push diff; unknown history cannot publish."""
    if (not all(isinstance(ref, str) and re.fullmatch(COMMIT_PATTERN, ref)
                and ref != '0' * 40 for ref in (before, after, expected_head))
            or after != expected_head):
        raise ValueError('A push requires its exact before and after commits')
    head = subprocess.run(['git', 'rev-parse', '--verify', 'HEAD'], cwd=cwd,
                          check=True, capture_output=True, text=True, timeout=30)
    if head.stdout.strip() != expected_head:
        raise ValueError('Checked-out source differs from the push commit')
    kind = subprocess.run(['git', 'cat-file', '-t', before], cwd=cwd,
                          check=True, capture_output=True, text=True, timeout=30)
    if kind.stdout.strip() != 'commit':
        raise ValueError('The push base is not a commit')
    diff = subprocess.run(['git', 'diff', '--no-renames', '--name-only', '-z',
                           before, after, '--'], cwd=cwd, check=True,
                          capture_output=True, text=True, timeout=30)
    if diff.stdout and not diff.stdout.endswith('\0'):
        raise ValueError('Incomplete changed-file list')
    return [path for path in diff.stdout.split('\0') if path]


def has_publication_changes(paths):
    """CI-only maintenance is not shipped; retain other publication behavior."""
    if not isinstance(paths, (list, tuple)):
        raise ValueError('A main push requires its complete changed-file list')
    if any(not isinstance(path, str) or not path or '\0' in path
           or any(part in ('', '.', '..') for part in path.split('/')) for path in paths):
        raise ValueError('Invalid changed-file path')
    return any(not path.startswith('.github/') for path in paths)


def publication_allowed(repository, ref, event, paths=None, manual_publish=False):
    if repository != REPOSITORY or ref != 'refs/heads/main':
        return False
    if event == 'push':
        return has_publication_changes(paths)
    if event == 'schedule':
        return True
    if event == 'workflow_dispatch':
        return manual_publish is True or manual_publish == 'true'
    return False


def main():
    env = os.environ
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    if not isinstance(event, dict):
        raise ValueError('Invalid event payload')
    paths = None
    if (env['GITHUB_REPOSITORY'], env['GITHUB_REF'], env['GITHUB_EVENT_NAME']) == (
            REPOSITORY, 'refs/heads/main', 'push'):
        paths = changed_paths(event.get('before'), event.get('after'), env.get('GITHUB_SHA'))
    publish = publication_allowed(env['GITHUB_REPOSITORY'], env['GITHUB_REF'],
                                  env['GITHUB_EVENT_NAME'], paths,
                                  event.get('inputs', {}).get('publish', False))
    with open(env['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
        output.write('publish=' + str(publish).lower() + '\n')


if __name__ == '__main__':
    main()
