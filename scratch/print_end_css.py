with open('web/css/style.css', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(13215, len(lines)):
    print(f"{i+1}: {lines[i]}", end="")
