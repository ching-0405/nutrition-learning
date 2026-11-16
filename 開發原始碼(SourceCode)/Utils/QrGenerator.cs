using System;
using System.Drawing;
using QRCoder;

namespace NutritionQRHub.Utils
{
    public static class QrGenerator
    {
        public static Bitmap GenerateQrCode(string content, int pixelsPerModule = 14)
        {
            using (var qrGenerator = new QRCodeGenerator())
            {
                using (var qrCodeData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q))
                {
                    using (var qrCode = new QRCode(qrCodeData))
                    {
                        // 產生深藍綠色帶有醫療質感之專屬 QR Code
                        return qrCode.GetGraphic(pixelsPerModule, Color.FromArgb(15, 118, 110), Color.White, true);
                    }
                }
            }
        }
    }
}
