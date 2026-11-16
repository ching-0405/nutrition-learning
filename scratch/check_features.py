import sys

def check(name, base):
    print(f"=== Checking {name} ===")
    js_path = f"{base}/js/app.js"
    html_path = f"{base}/index.html"
    css_path = f"{base}/css/style.css"

    with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
        js = f.read()
    with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
        html = f.read()
    with open(css_path, 'r', encoding='utf-8', errors='ignore') as f:
        css = f.read()

    p1 = '輔英科技大學保健營養系 伊麗克絲 營養師' in js
    p2 = 'medicalCityVideoBgmWasPlaying && soundEnabled) playBgm()' in js
    p3 = 'color:#fef08a;">含糖飲料' in js
    p4 = 'color:#fef08a;">飲食習慣' in js
    p5 = 'research_stage_bgm.mp3' in js
    p6 = ('正確科學方法' not in html) or ('display:none' in html)
    p7 = ('display: none !important;' in css) and ('cover !important' in css)
    p8 = ('isCompletedCommunityStage' in js) and ('isCompletedResearchStage' in js)
    p9 = 'title>營養教學平台 - 營養勇者傳說' in html

    print("  1. 伊麗克絲營養師:", p1)
    print("  2. 醫療之城影片完播BGM:", p2)
    print("  3. 含糖飲料 黃色:", p3)
    print("  4. 飲食習慣 黃色:", p4)
    print("  5. research_stage_bgm.mp3:", p5)
    print("  6. 正確科學方法 hidden:", p6)
    print("  7. Full cover in CSS:", p7)
    print("  8. PR #7 stage cleared flags:", p8)
    print("  9. 營養勇者傳說 標題:", p9)

if __name__ == '__main__':
    check("Nutrition_student_trial", "Nutrition_student_trial")
    check("web", "web")
