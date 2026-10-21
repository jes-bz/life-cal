"""Build a Shortcut with silent refresh, website settings, and native preview."""
import plistlib
import json
import subprocess
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent.parent
subprocess.run(["node", "scriptable/build.mjs"], cwd=ROOT, check=True)
source = (ROOT / "dist/life-calendar-interactive.js").read_text()
release = json.loads((ROOT / "release.json").read_text())
preflight_source = source.replace(
    "Script.setShortcutOutput(await executeLifeCalendar(args.shortcutParameter));",
    "Script.setShortcutOutput(await preflightLifeCalendar(args.shortcutParameter));",
)
actions = []


def action(identifier, **parameters):
    uid = str(uuid4()).upper()
    actions.append({"WFWorkflowActionIdentifier": identifier,
                    "WFWorkflowActionParameters": {"UUID": uid, **parameters}})
    return uid


def reference(uid=None, name=None):
    value = {"Type": "ExtensionInput", "Aggrandizements": [{
        "Type": "WFCoercionVariableAggrandizement", "CoercionItemClass": "WFStringContentItem"}]} if uid is None else {
        "Type": "ActionOutput", "OutputUUID": uid, "OutputName": name}
    return {"WFSerializationType": "WFTextTokenAttachment", "Value": value}


def text_output(uid, name):
    return {"WFSerializationType": "WFTextTokenString", "Value": {
        "string": "\ufffc", "attachmentsByRange": {
            "{0, 1}": reference(uid, name)["Value"]}}}


group = str(uuid4()).upper()
action("is.workflow.actions.comment", WFCommentActionText=
       f"Life Calendar {release['version']}\n{release['siteUrl']}\nChange colors/settings: hold link → Open Link.\nSaved designs refresh silently.")
preflight = action("dk.simonbs.Scriptable.RunScriptInlineIntent", script=preflight_source,
                   parameter=reference(), runInApp=False, ShowWhenRun=False)
preflight_text = action("is.workflow.actions.gettext",
                        WFTextActionText=text_output(preflight, "Output"))
action("is.workflow.actions.conditional", WFControlFlowMode=0,
       GroupingIdentifier=group, WFCondition=4, WFConditionalActionString="setup",
       WFInput={"Type": "Variable", "Variable": reference(preflight_text, "Text")})
# The preflight already marks the manual setup handoff as pending. Run the
# settings UI only in Scriptable's foreground so no Alert reaches Siri.
action("dk.simonbs.Scriptable.RunScriptInlineIntent", script=source,
       parameter=reference(), runInApp=True, ShowWhenRun=False)
action("is.workflow.actions.waittoreturn")
finish_text = action("is.workflow.actions.gettext", WFTextActionText="finish")
action("dk.simonbs.Scriptable.RunScriptInlineIntent", script=source,
       parameter=reference(finish_text, "Text"), runInApp=False, ShowWhenRun=False)
action("is.workflow.actions.conditional", WFControlFlowMode=1, GroupingIdentifier=group)
action("is.workflow.actions.gettext", WFTextActionText=text_output(preflight, "Output"))
result = action("is.workflow.actions.conditional", WFControlFlowMode=2, GroupingIdentifier=group)
navigation_group = str(uuid4()).upper()
action("is.workflow.actions.conditional", WFControlFlowMode=0,
       GroupingIdentifier=navigation_group, WFCondition=99, WFConditionalActionString="://",
       WFInput={"Type": "Variable", "Variable": reference(result, "If Result")})
action("is.workflow.actions.openurl", WFInput=reference(result, "If Result"))
action("is.workflow.actions.output", WFOutput="")
action("is.workflow.actions.conditional", WFControlFlowMode=2, GroupingIdentifier=navigation_group)
decoded = action("is.workflow.actions.base64encode", WFEncodeMode="Decode",
                 WFInput=reference(result, "If Result"))
images = action("is.workflow.actions.detect.images", WFInput=reference(decoded, "Base64 Encoded"))
action("is.workflow.actions.wallpaper.set", WFInput=reference(images, "Images"),
       WFWallpaperLocation="Lock Screen", WFWallpaperSmartCrop=False,
       WFWallpaperShowPreview=False)

shortcut = {
    "WFWorkflowName": "Life Calendar",
    "WFWorkflowClientVersion": "5114.0.8.3",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowActions": actions,
    "WFWorkflowImportQuestions": [],
    "WFWorkflowIcon": {"WFWorkflowIconGlyphNumber": 61440,
                       "WFWorkflowIconStartColor": 255},
    "WFWorkflowInputContentItemClasses": ["WFStringContentItem"],
    "WFWorkflowOutputContentItemClasses": ["WFImageContentItem"],
    "WFWorkflowTypes": [],
    "WFQuickActionSurfaces": [],
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowHasShortcutInputVariables": True,
}
destination = ROOT / "dist/Life Calendar.unsigned.shortcut"
destination.write_bytes(plistlib.dumps(shortcut, fmt=plistlib.FMT_BINARY))
print(destination)
