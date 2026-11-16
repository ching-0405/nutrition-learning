with open('web/assets/port_stage_options_menu.jpg', 'rb') as f1, open('Nutrition_student_trial/assets/port_stage_options_menu.jpg', 'rb') as f2:
    b1 = f1.read()
    b2 = f2.read()
    print('b1 == b2:', b1 == b2)
    print('len b1:', len(b1), 'len b2:', len(b2))
