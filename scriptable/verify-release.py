#!/usr/bin/env python3
"""Verify a phone-shared Shortcut against this source before publishing its link."""
import argparse
import hashlib
import json
import plistlib
import re
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'release.json'
PATHS = {'fresh-install', 'safari-apply', 'cancel', 'edit-website', 'empty-refresh'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(*args):
    subprocess.run(args, check=True, capture_output=True)


def unpack(path, scratch):
    data = path.read_bytes()
    if data.startswith((b'bplist', b'<?xml')):
        return plistlib.loads(data)
    if not data.startswith(b'AEA1'):
        raise ValueError('Expected a signed Apple Archive or workflow plist')
    length = int.from_bytes(data[8:12], 'little')
    header = plistlib.loads(data[12:12 + length])
    cert, public, der = [scratch / name for name in ('certificate.der', 'public.pem', 'public.der')]
    cert.write_bytes(header['SigningCertificateChain'][0])
    command('openssl', 'x509', '-inform', 'DER', '-in', str(cert), '-pubkey', '-noout', '-out', str(public))
    command('openssl', 'pkey', '-pubin', '-in', str(public), '-outform', 'DER', '-out', str(der))
    spki = der.read_bytes()
    if bytes.fromhex('06082a8648ce3d030107') not in spki or spki[-65] != 4:
        raise ValueError('Expected an uncompressed P-256 signing key')
    key, archive, extracted = [scratch / name for name in ('key.txt', 'workflow.aar', 'extracted')]
    key.write_text('hex:' + spki[-65:].hex())
    command('aea', 'decrypt', '-i', str(path), '-o', str(archive), '-sign-pub', str(key))
    command('aa', 'extract', '-i', str(archive), '-d', str(extracted))
    return plistlib.loads((extracted / 'Shortcut.wflow').read_bytes())


def normalized_actions(workflow):
    actions = workflow['WFWorkflowActions']
    ids = {a['WFWorkflowActionParameters']['UUID']: i for i, a in enumerate(actions)
           if 'UUID' in a['WFWorkflowActionParameters']}
    groups = {}
    def normalize(value):
        if isinstance(value, dict):
            result = {}
            for key, child in value.items():
                if key == 'UUID':
                    continue
                if key == 'OutputUUID':
                    result[key] = ids.get(child, 'BROKEN REFERENCE')
                elif key == 'GroupingIdentifier':
                    result[key] = groups.setdefault(child, len(groups))
                else:
                    result[key] = normalize(child)
            return result
        if isinstance(value, list):
            return [normalize(child) for child in value]
        return value
    return [normalize(action) for action in actions]


def require_subset(expected, actual, path='workflow'):
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f'{path}: expected dictionary'
        for key, value in expected.items():
            assert key in actual, f'{path}: missing {key}'
            require_subset(value, actual[key], f'{path}.{key}')
    elif isinstance(expected, list):
        assert isinstance(actual, list) and len(expected) == len(actual), f'{path}: unexpected action/value count'
        for index, value in enumerate(expected):
            require_subset(value, actual[index], f'{path}[{index}]')
    else:
        # Never echo source, settings, or temporary asset URLs on mismatch.
        assert expected == actual, f'{path}: differs from packaged source'


def source_hashes(expected):
    return [digest(a['WFWorkflowActionParameters']['script'].encode())
            for a in expected['WFWorkflowActions'] if 'script' in a['WFWorkflowActionParameters']]


def check_links(release):
    source = (ROOT / 'index.html').read_text()
    assert f"const WEBSITE_VERSION = '{release['version']}';" in source, 'Website handoff version differs from release'
    assert f"./calendar-design.js?v={release['version']}" in source, 'Design module cache version differs from release'
    for name in ('index.html', 'README.md', 'scriptable/README.md'):
        urls = re.findall(r'https://www\.icloud\.com/shortcuts/[a-f0-9]{32}', (ROOT / name).read_text())
        assert urls and set(urls) == {release['shortcutUrl']}, f'{name}: stale shortcut link'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url', nargs='?', help='New public iCloud Shortcut URL')
    parser.add_argument('--file', type=Path, help='Inspect an already downloaded payload')
    parser.add_argument('--record', action='store_true', help='Record verified payload and update install links')
    parser.add_argument('--smoke-tested', default='', help='Comma-separated on-device paths actually exercised')
    parser.add_argument('--check-recorded', action='store_true', help='Check source and site against the recorded release')
    args = parser.parse_args()
    subprocess.run(['python3', 'scriptable/package.py'], cwd=ROOT, check=True, capture_output=True)
    expected = plistlib.loads((ROOT / 'dist/Life Calendar.unsigned.shortcut').read_bytes())
    release = json.loads(MANIFEST.read_text())
    hashes = source_hashes(expected)
    if args.check_recorded:
        assert release.get('shortcutSha256'), 'No verified signed release recorded'
        assert release.get('verifiedVersion') == release['version'], 'Version changed since shared release verification'
        assert hashes == release.get('scriptSha256'), 'Source changed since shared release verification'
        assert set(release.get('verifiedPaths', [])) == PATHS, 'On-device release checklist is incomplete'
        check_links(release)
        print(f"Release {release['version']}: source, smoke-test checklist, and site links match")
        return
    url = args.url or release['shortcutUrl']
    match = re.fullmatch(r'https://www\.icloud\.com/shortcuts/([a-f0-9]{32})', url)
    assert match, 'Expected a public iCloud Shortcut URL'
    with tempfile.TemporaryDirectory(prefix='life-calendar-release-') as directory:
        scratch = Path(directory)
        payload = args.file
        if payload is None:
            with urllib.request.urlopen('https://www.icloud.com/shortcuts/api/records/' + match[1], timeout=30) as response:
                record = json.load(response)
            asset = record['fields']['signedShortcut']['value']['downloadURL'].replace('${f}', 'Life%20Calendar.shortcut')
            with urllib.request.urlopen(asset, timeout=30) as response:
                data = response.read()
            payload = scratch / 'shared.shortcut'
            payload.write_bytes(data)
        actual = unpack(payload, scratch)
        signed_payload = payload.read_bytes().startswith(b'AEA1')
        require_subset(normalized_actions(expected), normalized_actions(actual))
        triggers = actual.get('WFWorkflowTriggers', [])
        assert len(triggers) == 1 and triggers[0]['WFTriggerIdentifier'] == 'WFTimeOfDayTrigger', 'Weekly trigger missing'
        parameters = triggers[0]['WFTriggerSerializedParameters']
        recurrence = parameters['WFRecurrence']
        assert parameters['WFTimeComponents'] == {'hour': 1, 'minute': 0}, 'Unexpected trigger time'
        assert recurrence['frequency'] == 4 and recurrence['interval'] == 1 and recurrence['weekdays'] == [{'every': 'fri'}], 'Unexpected weekly recurrence'
        payload_hash = digest(payload.read_bytes())
    print(f"Release {release['version']}: exact scripts, action wiring, cancellation, and Friday 1 AM trigger verified")
    if args.record:
        assert signed_payload, 'Record only a signed iCloud release payload'
        assert set(filter(None, args.smoke_tested.split(','))) == PATHS, 'Record only after all five on-device paths pass'
        assert payload_hash and actual.get('WFWorkflowTriggers'), 'Shared release must retain its trigger'
        assert not (release.get('verifiedVersion') == release['version'] and release.get('scriptSha256') != hashes), 'Increment the version before recording changed source'
        old_url = release['shortcutUrl']
        release.update(shortcutUrl=url, shortcutSha256=payload_hash, scriptSha256=hashes,
                       verifiedVersion=release['version'], verifiedPaths=sorted(PATHS))
        MANIFEST.write_text(json.dumps(release, indent=2) + '\n')
        for name in ('index.html', 'README.md', 'scriptable/README.md'):
            path = ROOT / name
            path.write_text(path.read_text().replace(old_url, url))
        check_links(release)
        print('Recorded verified release and updated all install links')


if __name__ == '__main__':
    main()
