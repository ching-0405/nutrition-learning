import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('Nutrition_student_trial/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

pos = html.find('port_stage_options_menu.jpg')
print(html[pos-100:pos+200])
