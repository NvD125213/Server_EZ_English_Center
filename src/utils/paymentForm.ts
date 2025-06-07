export const htmlPaymentForm = (message: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Thông báo thanh toán - EZ Center</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <style>
        /* Reset styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        /* Base styles */
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #000000;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* Container */
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px 20px;
        }

        /* Card */
        .email-card {
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
            overflow: hidden;
        }

        .email-content {
            padding: 48px 32px;
            text-align: center;
        }

        /* Logo */
        .logo {
            margin-bottom: 32px;
        }

        .logo img {
            width: 60px;
            height: 60px;
            border-radius: 12px;
        }

        /* Typography */
        .main-title {
            font-size: 24px;
            font-weight: 600;
            color: #000000;
            margin-bottom: 16px;
            line-height: 1.3;
            letter-spacing: -0.02em;
        }

        .subtitle {
            font-size: 15px;
            color: #000000;
            margin-bottom: 32px;
            line-height: 1.5;
        }

        .description {
            font-size: 14px;
            color: #000000;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        /* Footer note */
        .footer-note {
            background-color: #ffffff;
            padding: 20px 24px;
            border-radius: 8px;
            border-top: 1px solid #e5e7eb;
        }

        .footer-text {
            font-size: 12px;
            color: #000000;
            line-height: 1.5;
            text-align: center;
        }

        /* Responsive design */
        @media only screen and (max-width: 600px) {
            .email-container {
                padding: 20px 16px;
            }
            
            .email-content {
                padding: 32px 24px;
            }
            
            .main-title {
                font-size: 20px;
            }
            
            .subtitle {
                font-size: 14px;
            }
            
            .description {
                font-size: 13px;
            }
        }

        /* Email client compatibility */
        table {
            border-collapse: collapse;
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }

        img {
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;
        }

        /* Outlook specific */
        <!--[if mso]>
        .main-title {
            font-family: Arial, sans-serif !important;
        }
        <![endif]-->
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-card">
            <div class="email-content">
                <!-- Logo -->
                <div class="logo">
                    <img src="https://ad99e0ee-d357-4a93-a166-981a4a2769c7.b-cdn.net/e/b45d6902-c621-415d-b4d6-c92274e69618/a0001934-73ad-4f6c-a005-fce75cccd4ee.png" 
                         alt="EZ Center Logo" 
                         width="60" 
                         height="60">
                </div>

                <!-- Main content -->
                <h1 class="main-title">${message}</h1>
                
                <p class="subtitle">
                    Nếu có bất kì điều gì thắc mắc vui lòng liên hệ chúng tôi.
                </p>
                
                <p class="description">
                    Hãy liên hệ lại với chúng tôi nếu đã thanh toán xong để chúng tôi gửi thông tin về lớp và lịch học cho bạn. Cảm ơn vì đã tin tưởng EZ Center.
                </p>
            </div>
            
            <!-- Footer -->
            <div class="footer-note">
                <p class="footer-text">
                    Đây là email tự động từ hệ thống EZ Center. Vui lòng không trả lời email này.
                </p>
            </div>
        </div>
    </div>

    <!-- Gmail fix -->
    <div style="display: none; white-space: nowrap; font: 15px courier; line-height: 0;">
        &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;
    </div>
</body>
</html>
`;
