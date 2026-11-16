import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="sceneLogin"')
if idx != -1:
    print(text[idx-50:idx+2500])
