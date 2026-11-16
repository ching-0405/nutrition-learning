import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')

git_path = r'C:\Users\User\AppData\Local\github-copilot-git-2.56.0-1\cmd\git.exe'
res = subprocess.run([git_path, '-C', 'Nutrition_student_trial', 'log', '-S', 'btnTrialStartDirect', '--oneline'], capture_output=True, text=True, encoding='utf-8')
print("Commits touching btnTrialStartDirect:\n", res.stdout)
