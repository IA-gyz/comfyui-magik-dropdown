# Magik Dropdown v2

A ComfyUI node with a JavaScript editor, a dynamic number of entries, and separate display labels and output text. No extra runtime dependencies.

## Installation

Replace the old `Magik_Dropdown` folder in `ComfyUI/custom_nodes/` with this folder. Restart ComfyUI and hard-refresh the browser. Add **Magik → Utilities → Magik Dropdown**.

Existing workflows keep their entries and selection. The first two outputs retain their positions; **Label** is appended as the third output.

## Selection

- Type in **Search labels or values** to filter dropdown options. Search does not change the selection, reorder the data, or change indices.
- Choose a label from the dropdown. The highlighted editor row identifies that selection.
- **◀ / ▶** select the previous or next entry. **Loop previous / next** controls wrapping at the ends.
- **Random** immediately picks an entry. Repeats are allowed.
- **Random on each execution** selects in the backend whenever the node executes, including API execution. Its cache is invalidated for every execution. The node displays the last entry actually executed when ComfyUI sends its execution message. Entries have equal probability and repeats are allowed.
- **Compact** hides the editor and reduces node height; **Edit entries** restores it. Search, selection, navigation, random and undo/redo remain available.

## Entry editor

Each entry has a short **Display label** and a separate, potentially multiline **Output value**. Both are literal text; dynamic prompt expansion is disabled. Duplicate labels and output values are allowed because entries have stable internal IDs. Labels must contain non-whitespace text; values may be empty.

Use **+ Add entry**, **×**, and **↑ / ↓** to add, delete and reorder entries. Field edits commit when you press Tab or click outside them. Renaming or reordering retains the selected entry. Deleting the selected entry selects the first remaining entry.

**Undo / Redo** retain up to 100 edits per node in the current session, including entry edits, selection changes, bulk replacement, preset loading and settings. A new edit clears redo. This transient history is cleared when the workflow is loaded; the entries and settings themselves remain saved.

## Presets and import/export

Enter a name and click **Save** to save an entry collection. Choose a preset and click **Load**, or **Delete** to remove it. Replacing or deleting an existing preset asks for confirmation. Presets contain labels and output values. They are shared across workflows in the **same browser profile and ComfyUI origin** using browser storage. Another browser or server address has separate presets; use JSON export to transfer them. Clearing browser site data removes presets but does not remove entries saved in a workflow.

Under **Bulk edit / import / export**:

- **Apply** accepts a v2 JSON collection, an array of strings, or plain text with one value per line. Plain text sets the label and value to the same text, trims whitespace, removes blank lines and merges duplicate lines.
- **Import file** reads JSON or TXT.
- **Export JSON** preserves IDs, labels, multiline values, empty values and entry order. Use this for lossless transfer.
- **Export TXT** exports values only, one per line. It omits labels and IDs, and cannot preserve empty entries or surrounding whitespace on reimport. Multiline values require JSON export.

The versioned JSON format is:

```json
{
  "version": 2,
  "items": [
    {"id": "portrait", "label": "Portrait", "value": "A detailed portrait prompt"}
  ]
}
```

Unknown object versions and malformed entry objects are rejected before replacing existing data. IDs must be nonempty and unique. Legacy plain-text workflow fields migrate automatically. The workflow stores entry data, selection, automatic selection mode, compact mode and loop preference; these are also retained on duplication.

## Inputs, outputs and API use

**index_override** is an optional INT socket, zero-based. An absent input or **-1** disables it. A nonnegative value overrides both manual and random selection. Out-of-range indices raise an explicit error instead of silently selecting another entry. Connecting a batch controller can therefore drive selection deterministically.

Outputs:

| Output | Type | Meaning |
|---|---|---|
| Selected | STRING | Full output value |
| Index | INT | Zero-based position, or -1 for an empty collection |
| Label | STRING | Display label |

An empty collection outputs `""`, `-1`, `""` when no override is active.

For API prompts, `entries` is either legacy text or a string containing the v2 JSON document. `selected` is the selected entry ID (legacy output text is also accepted). Optional `selection_mode` is `manual` or `random`; optional `index_override` defaults to `-1`. When selection is invalid, manual mode falls back to the first entry. Random selection follows Python's random generator and is not driven by a workflow seed.

## Verification

Run `python tests/test_backend.py` and `node tests/test_model.mjs` from this folder. `node tests/test_ui.cjs` additionally requires Playwright and its Chromium browser; these are development tools, not extension dependencies. The browser harness exercises the editor with a mock ComfyUI node host. Actual ComfyUI integration still requires verification in a running installation.
