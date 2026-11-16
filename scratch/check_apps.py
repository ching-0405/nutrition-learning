import sys

for path in ['web/js/app.js', 'web/js/app-LAPTOP-E05S4EJA.js', 'Nutrition_student_trial/js/app.js']:
    try:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            t = f.read()
        print("Path:", path)
        print("  has yellow sugar drinks:", 'color:#fef08a;">含糖飲料' in t)
        print("  has research_stage_bgm.mp3:", 'research_stage_bgm.mp3' in t)
        print("  has getNutritionInternDisplayName:", 'getNutritionInternDisplayName' in t)
        print("  has isCompletedCommunityStage:", 'isCompletedCommunityStage' in t)
        print("  has 伊麗克絲:", '伊麗克絲' in t)
    except Exception as e:
        print("Error on", path, e)
