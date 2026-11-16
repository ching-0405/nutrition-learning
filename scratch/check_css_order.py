with open('web/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines[:60]):
    if 'style.css' in l or '<style>' in l:
        print(f"Line {i+1}: {l.strip()}")
