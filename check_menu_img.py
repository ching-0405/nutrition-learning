from PIL import Image

for path in [
    'web/assets/port_stage_options_menu.jpg',
    'Nutrition_student_trial/assets/port_stage_options_menu.jpg',
    'C:/Users/User/.gemini/antigravity/brain/c3afb5d0-f6d7-4d70-a161-d630b885b640/.user_uploaded/media_1792930357261_bfa55bf0.png'
]:
    try:
        im = Image.open(path)
        print(path, im.size, im.format)
    except Exception as e:
        print(path, e)
