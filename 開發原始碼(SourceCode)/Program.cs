using System;
using System.IO;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace NutritionQRHub
{
    static class Program
    {
        [DllImport("shell32.dll", SetLastError = true)]
        private static extern void SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

        [STAThread]
        static void Main()
        {
            try
            {
                try { SetCurrentProcessExplicitAppUserModelID("Fooyin.Nutrition.InteractivePlatform"); } catch { }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);

                Application.ThreadException += (sender, e) =>
                {
                    LogAndShowError("UI Thread Exception", e.Exception);
                };

                AppDomain.CurrentDomain.UnhandledException += (sender, e) =>
                {
                    LogAndShowError("Domain Unhandled Exception", e.ExceptionObject as Exception);
                };

                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                LogAndShowError("Main Exception", ex);
            }
        }

        private static void LogAndShowError(string type, Exception ex)
        {
            string msg = ex != null ? ex.ToString() : "未知錯誤";
            try
            {
                File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash.log"), "[" + type + "] " + DateTime.Now + Environment.NewLine + msg);
            }
            catch { }
            MessageBox.Show("應用程式啟動或執行時發生錯誤：\n\n" + (ex != null ? ex.Message : "未知錯誤") + "\n\n詳細資訊已記錄於 crash.log", "營養教學平台 - 錯誤提示", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
