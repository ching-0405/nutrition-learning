import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('Nutrition_student_trial/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = [(m.start(), m.group(0)) for m in re.finditer(r'#healthContinentMap|\.health-continent-interactive-map', css)]
for pos, match in matches:
    rule_start = css.rfind('{', 0, pos)
    rule_end = css.find('}', pos)
    sel = css[css.rfind('\n', 0, rule_start):rule_start].strip()
    rule = css[rule_start:rule_end+1].strip()
    print('pos:', pos, 'SEL:', sel)
    print('RULE:', rule)
    print('='*50)
