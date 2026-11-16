import io

def remove_badge_text():
    # Update web/index.html
    with open('web/index.html', 'r', encoding='utf-8') as f:
        text = f.read()

    target = '<div class="forest-overlay-result-badge correct">✅ 正確科學方法</div>'
    replacement = '<div class="forest-overlay-result-badge correct" style="display:none !important;"></div>'

    if target in text:
        text = text.replace(target, replacement)
        with open('web/index.html', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Updated web/index.html")
    else:
        print("Target not found in web/index.html")

    # Update Nutrition_student_trial/index.html if exists
    try:
        with open('Nutrition_student_trial/index.html', 'r', encoding='utf-8') as f:
            nst_text = f.read()
        if target in nst_text:
            nst_text = nst_text.replace(target, replacement)
            with open('Nutrition_student_trial/index.html', 'w', encoding='utf-8') as f:
                f.write(nst_text)
            print("Updated Nutrition_student_trial/index.html")
    except Exception as e:
        print("Nutrition_student_trial/index.html error:", e)

if __name__ == '__main__':
    remove_badge_text()
