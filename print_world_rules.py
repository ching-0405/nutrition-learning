import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('Nutrition_student_trial/css/style.css', 'r', encoding='utf-8') as f:
    css = f.read()

import re
matches = [(m.start(), m.group(0)) for m in re.finditer(r'#healthContinentWorld|\.health-continent-world', css)]
for pos, match in matches:
    rule_start = css.rfind('{', 0, pos)
    rule_end = css.find('}', pos)
    print('pos:', pos, 'RULE:', css[rule_start:rule_end+1])
