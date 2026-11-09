"""Magik Dropdown v2: JavaScript editor and validated execution."""
import json
import random


def parse_entries(text):
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        data = None
    if isinstance(data, dict):
        if data.get('version') != 2 or not isinstance(data.get('items'), list):
            raise ValueError('Unsupported Magik Dropdown data format')
        items, ids = [], set()
        for item in data['items']:
            if not isinstance(item, dict) or any(not isinstance(item.get(k), str) for k in ('id', 'label', 'value')):
                raise ValueError('Each dropdown entry needs string id, label and value')
            if not item['id'] or item['id'] in ids or not item['label'].strip():
                raise ValueError('Dropdown entry IDs must be unique and labels nonempty')
            ids.add(item['id'])
            items.append(dict(item))
        return items
    values = list(dict.fromkeys(line.strip() for line in str(text).splitlines() if line.strip()))
    return [dict(id=f'legacy-{i}', label=v, value=v) for i, v in enumerate(values)]


class MagikDropdown:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'selected': ('STRING', {'default': 'Entry 1', 'dynamicPrompts': False}),
            'entries': ('STRING', {'default': 'Entry 1\nEntry 2', 'multiline': True, 'dynamicPrompts': False}),
        }, 'optional': {
            'selection_mode': ('STRING', {'default': 'manual', 'dynamicPrompts': False}),
            'index_override': ('INT', {'default': -1, 'min': -1, 'forceInput': True}),
        }}

    RETURN_TYPES = ('STRING', 'INT', 'STRING')
    RETURN_NAMES = ('Selected', 'Index', 'Label')
    FUNCTION = 'select'
    CATEGORY = 'Magik/Utilities'
    DESCRIPTION = 'Searchable dropdown with label/value pairs, presets and random selection. Index starts at 0.'

    @classmethod
    def IS_CHANGED(cls, selected, entries, selection_mode='manual', index_override=-1):
        return float('nan') if selection_mode == 'random' and index_override == -1 else (selected, entries, selection_mode, index_override)

    def select(self, selected, entries, selection_mode='manual', index_override=-1):
        items = parse_entries(entries)
        if selection_mode not in ('manual', 'random'):
            raise ValueError('Selection mode must be manual or random')
        if isinstance(index_override, bool) or not isinstance(index_override, int) or index_override < -1:
            raise ValueError('Index override must be -1 (disabled) or a zero-based integer')
        if index_override >= 0:
            if index_override >= len(items):
                raise ValueError(f'Index override {index_override} is outside the {len(items)} dropdown entries')
            index = index_override
        elif items:
            index = random.randrange(len(items)) if selection_mode == 'random' else next(
                (i for i, item in enumerate(items) if item['id'] == selected),
                next((i for i, item in enumerate(items) if item['value'] == selected), 0))
        else:
            index = -1
        item = items[index] if index >= 0 else dict(id='', value='', label='')
        return {'ui': {'selected_id': [item['id']], 'selected_index': [index], 'selected_label': [item['label']]},
                'result': (item['value'], index, item['label'])}


NODE_CLASS_MAPPINGS = {'MagikDropdown': MagikDropdown}
NODE_DISPLAY_NAME_MAPPINGS = {'MagikDropdown': 'Magik Dropdown'}
WEB_DIRECTORY = './web'
