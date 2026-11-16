with open('web/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

start = text.find('<style>')
end = text.find('</style>')
print(text[start:end+8])
