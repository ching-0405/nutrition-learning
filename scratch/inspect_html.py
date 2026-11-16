import sys

with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

for tag in ['characterStage', 'charNurse', 'charStudent', 'stageBackdrop', 'trialBgStartArea', 'rpgBottomPanel']:
    idx = text.find(f'id="{tag}"')
    if idx != -1:
        print(f"=== {tag} ===")
        print(text[max(0, idx-50):min(len(text), idx+200)])
