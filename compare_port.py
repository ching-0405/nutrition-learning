from PIL import Image

for path in ['web/assets/rpg_bg_continent_port.png', 'Nutrition_student_trial/assets/rpg_bg_continent_port.png', 'Nutrition_student_trial/assets/rpg_bg_continent_port_backup.png']:
    try:
        im = Image.open(path)
        print(path, im.size, im.format)
    except Exception as e:
        print(path, 'ERROR:', e)
