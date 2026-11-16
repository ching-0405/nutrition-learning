import glob
for ext in ['*.jpg', '*.png', '*.webp', '*.jpeg']:
    for f in glob.glob('web/assets/' + ext):
        print(f)
