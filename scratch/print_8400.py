with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(8395, 8420):
    print(f"{i+1}: {lines[i]}", end="")
