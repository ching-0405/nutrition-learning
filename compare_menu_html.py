import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('web/index.html', 'r', encoding='utf-8') as f:
    web_html = f.read()

pos = web_html.find('port_stage_options_menu.jpg')
print('web/index.html:')
print(web_html[pos-100:pos+200])

with open('Nutrition_student_trial/index.html', 'r', encoding='utf-8') as f:
    trial_html = f.read()

pos2 = trial_html.find('port_stage_options_menu.jpg')
print('Nutrition_student_trial/index.html:')
print(trial_html[pos2-100:pos2+200])
