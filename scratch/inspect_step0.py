with open('web/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(4090, 4135):
    print(f"{i+1}: {lines[i]}", end="")
