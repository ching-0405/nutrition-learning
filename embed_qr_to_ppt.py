import sys
import os
import json

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def embed_qr(ppt_path, qr_path, slide_num=1):
    ppt_path = os.path.abspath(ppt_path)
    qr_path = os.path.abspath(qr_path)
    
    if not os.path.exists(qr_path):
        print(f'ERROR: QR 圖檔不存在: {qr_path}')
        return False

    try:
        slide_num = int(slide_num)
    except Exception:
        slide_num = 1

    # 1. 優先嘗試 PowerPoint COM 自動化 (若 PowerPoint 正在運行且已開啟簡報)
    try:
        import win32com.client
        ppt_app = win32com.client.GetActiveObject('PowerPoint.Application')
        target_pres = None
        ppt_base = os.path.basename(ppt_path).lower()
        
        for pres in ppt_app.Presentations:
            try:
                if os.path.normcase(pres.FullName) == os.path.normcase(ppt_path) or os.path.basename(pres.Name).lower() == ppt_base:
                    target_pres = pres
                    break
            except Exception:
                pass
        
        if target_pres is None and ppt_app.Presentations.Count > 0:
            target_pres = ppt_app.ActivePresentation

        if target_pres:
            total_slides = target_pres.Slides.Count
            target_idx = max(1, min(total_slides, slide_num))
            slide = target_pres.Slides(target_idx)
            
            # 位置：右下角 (寬度 140, 高度 140, 邊距 25)
            sw = target_pres.PageSetup.SlideWidth
            sh = target_pres.PageSetup.SlideHeight
            w = 140
            h = 140
            left = sw - w - 25
            top = sh - h - 25
            
            # 插入圖片
            slide.Shapes.AddPicture(qr_path, False, True, left, top, w, h)
            print(f"SUCCESS_COM: 成功置入已開啟之 PowerPoint《{target_pres.Name}》第 {target_idx} 頁！")
            return True
    except Exception as ex_com:
        pass

    # 2. 若 COM 未處理，使用 python-pptx 直接修改 PPTX 檔案
    if not os.path.exists(ppt_path):
        print(f"ERROR: 找不到 PPTX 檔案: {ppt_path}")
        return False

    try:
        from pptx import Presentation
        from pptx.util import Inches
        
        prs = Presentation(ppt_path)
        total_slides = len(prs.slides)
        if total_slides == 0:
            print(f"ERROR: 簡報《{os.path.basename(ppt_path)}》內無任何投影片")
            return False
            
        target_idx = max(0, min(total_slides - 1, slide_num - 1))
        slide = prs.slides[target_idx]
        
        sw = prs.slide_width
        sh = prs.slide_height
        qr_size = Inches(2.0)
        left = sw - qr_size - Inches(0.4)
        top = sh - qr_size - Inches(0.4)
        
        slide.shapes.add_picture(qr_path, left, top, width=qr_size, height=qr_size)
        prs.save(ppt_path)
        print(f"SUCCESS_PPTX: 成功將 QR Code 寫入《{os.path.basename(ppt_path)}》第 {target_idx + 1} 頁！")
        return True
    except Exception as ex_pptx:
        print(f"ERROR_PPTX: {ex_pptx}")
        return False

if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == '--task':
        task_file = sys.argv[2]
        if not os.path.exists(task_file):
            print(f"ERROR: Task file not found: {task_file}")
            sys.exit(1)
        try:
            with open(task_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            p_path = data.get('ppt_path', '')
            q_path = data.get('qr_path', '')
            s_num = data.get('slide_num', 1)
            success = embed_qr(p_path, q_path, s_num)
            sys.exit(0 if success else 1)
        except Exception as e:
            print(f"ERROR_TASK: {e}")
            sys.exit(1)
    elif len(sys.argv) >= 3:
        p_path = sys.argv[1]
        q_path = sys.argv[2]
        s_num = sys.argv[3] if len(sys.argv) > 3 else 1
        success = embed_qr(p_path, q_path, s_num)
        sys.exit(0 if success else 1)
    else:
        print("Usage: python embed_qr_to_ppt.py --task <task_json> OR python embed_qr_to_ppt.py <ppt_path> <qr_path> [slide_number]")
        sys.exit(1)
