import importlib.util
import json
import math
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('magik_dropdown', Path(__file__).parents[1] / '__init__.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.node = module.MagikDropdown()
        self.data = json.dumps({'version': 2, 'items': [
            {'id': 'one', 'label': 'Portrait', 'value': 'line 1\nline 2 {a|b}'},
            {'id': 'two', 'label': 'Landscape', 'value': ''},
        ]})

    def test_legacy(self):
        self.assertEqual(self.node.select('B', ' A\nB\nB\n')['result'], ('B', 1, 'B'))
        self.assertEqual(self.node.select('deleted', 'A\nB')['result'], ('A', 0, 'A'))

    def test_values_and_override(self):
        self.assertEqual(self.node.select('one', self.data)['result'], ('line 1\nline 2 {a|b}', 0, 'Portrait'))
        self.assertEqual(self.node.select('one', self.data, 'random', 1)['result'], ('', 1, 'Landscape'))
        with self.assertRaises(ValueError): self.node.select('one', self.data, index_override=2)
        with self.assertRaises(ValueError): self.node.select('one', self.data, index_override=-2)
        with self.assertRaises(ValueError): self.node.select('one', self.data, index_override=True)

    def test_random_and_cache(self):
        with patch.object(module.random, 'randrange', return_value=1) as random:
            result = self.node.select('one', self.data, 'random')
            self.assertEqual(result['result'], ('', 1, 'Landscape'))
            self.assertEqual(result['ui']['selected_id'], ['two'])
            random.assert_called_once_with(2)
        self.assertTrue(math.isnan(self.node.IS_CHANGED('one', self.data, 'random')))
        self.assertEqual(self.node.IS_CHANGED('one', self.data), self.node.IS_CHANGED('one', self.data))
        self.assertEqual(self.node.IS_CHANGED('one', self.data, 'random', 0), self.node.IS_CHANGED('one', self.data, 'random', 0))

    def test_invalid_and_empty(self):
        self.assertEqual(self.node.select('x', '')['result'], ('', -1, ''))
        for text in ['{"version":99,"items":[]}', '{"version":2,"items":[{}]}',
                     '{"version":2,"items":[{"id":"a","label":" ","value":"b"}]}']:
            with self.assertRaises(ValueError): self.node.select('x', text)

if __name__ == '__main__': unittest.main()
