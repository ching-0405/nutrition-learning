with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(1915, 1945):
    print(f"{i+1}: {lines[i]}", end="")
