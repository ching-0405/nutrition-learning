with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
idx = text.find('sceneLogin')
if idx != -1:
    print(text[idx-50:idx+800])
