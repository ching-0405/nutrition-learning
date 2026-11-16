import io

def run():
    with open('web/js/app.js', 'r', encoding='utf-8') as f:
        text = f.read()

    # Replace speakerBadge.textContent = '專業營養師' in research stage step 0
    # and in step 5
    old_step0 = "if (speakerBadge) speakerBadge.textContent = '專業營養師';"
    new_step0 = "if (speakerBadge) speakerBadge.innerHTML = '<span class=\"speaker-name-highlight-white\">輔英科技大學保健營養系 伊麗克絲 營養師</span>';"

    # Check how many times old_step0 appears
    count = text.count(old_step0)
    print(f"Found {count} occurrences of {old_step0}")

    if count == 2:
        text = text.replace(old_step0, new_step0)
        # Also update img.alt and tag.textContent
        text = text.replace("img.alt = '專業營養師';", "img.alt = '輔英科技大學保健營養系 伊麗克絲 營養師';")
        text = text.replace("if (tag) tag.textContent = '專業營養師';", "if (tag) tag.textContent = '輔英科技大學保健營養系 伊麗克絲 營養師';")
        
        with open('web/js/app.js', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Updated web/js/app.js successfully!")
    else:
        print("Count was not 2, please inspect.")

if __name__ == '__main__':
    run()
