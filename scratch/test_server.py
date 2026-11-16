import urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')

resp = urllib.request.urlopen('http://127.0.0.1:5050/')
html = resp.read().decode('utf-8', errors='ignore')

print('HTTP Status:', resp.status)
print('Has body class unit-new_student_trial trial-step-0:', 'class="unit-new_student_trial trial-step-0"' in html)
print('Has stageBackdrop background-image style:', 'assets/new_student_trial_login_bg.jpg' in html)
print('Has Step 0 defensive CSS in index.html:', 'Step 0 首頁防禦性樣式' in html)
