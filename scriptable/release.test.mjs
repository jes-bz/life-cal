import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

execFileSync('python3', ['scriptable/package.py']);
const directory = await mkdtemp(join(tmpdir(), 'life-calendar-release-test-'));
const makeFixture = (mode) => {
    const path = join(directory, `${mode}.shortcut`);
    execFileSync('python3', ['-c', `
import plistlib,sys,uuid
from pathlib import Path
w=plistlib.loads(Path('dist/Life Calendar.unsigned.shortcut').read_bytes())
w['WFWorkflowTriggers']=[{'WFTriggerIdentifier':'WFTimeOfDayTrigger','WFTriggerSerializedParameters':{
'WFTimeComponents':{'hour':1,'minute':0},'WFRecurrence':{'frequency':4,'interval':1,'weekdays':[{'every':'fri'}]}}}]
mode=sys.argv[1]
if mode=='optional-uuid':
 next(a for a in w['WFWorkflowActions'] if a['WFWorkflowActionIdentifier']=='is.workflow.actions.comment')['WFWorkflowActionParameters'].pop('UUID')
elif mode=='script':
 next(a for a in w['WFWorkflowActions'] if 'script' in a['WFWorkflowActionParameters'])['WFWorkflowActionParameters']['script']+='\\n// stale edit'
elif mode=='wiring':
 next(a for a in w['WFWorkflowActions'] if a['WFWorkflowActionIdentifier']=='is.workflow.actions.base64encode')['WFWorkflowActionParameters']['WFInput']['Value']['OutputUUID']=str(uuid.uuid4())
elif mode=='trigger':
 w['WFWorkflowTriggers']=[]
elif mode=='cancel':
 w['WFWorkflowActions']=[a for a in w['WFWorkflowActions'] if a['WFWorkflowActionIdentifier']!='is.workflow.actions.output']
Path(sys.argv[2]).write_bytes(plistlib.dumps(w,fmt=plistlib.FMT_BINARY))
`, mode, path]);
    return path;
};
try {
    for (const mode of ['valid', 'optional-uuid', 'script', 'wiring', 'trigger', 'cancel']) {
        const accepted = ['valid', 'optional-uuid'].includes(mode);
        test(`release verifier ${accepted ? `accepts ${mode} workflow` : `rejects changed ${mode}`}`, () => {
            const result = spawnSync('python3', ['scriptable/verify-release.py', '--file', makeFixture(mode)], { encoding: 'utf8' });
            assert.equal(result.status === 0, accepted, result.stdout + result.stderr);
        });
    }
} finally {
    test.after(async () => { await rm(directory, { recursive: true, force: true }); });
}
