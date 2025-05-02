import nodemailer from "nodemailer";

export const sendOTP = async (email: any, otp: any) => {
  try {
    let transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Sử dụng TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: '"ADMINISTRATOR SYSTEM EZ CENTER" <ilovejapansong@gmail.com>',
      to: email,
      subject: "MÃ OTP XÁC THỰC CỦA BẠN",
      text: `Mã OTP của bạn là <span style="">${otp}</span>`,
      html: `<p>Mã OTP của bạn là: <span style="font-weight: bold, font-size: "20px">${otp}</span></p>
            <p>Mã otp sẽ có hiệu lực trong <span style="font-weight: bold">5 phút</span></p>`,
    });
  } catch (error) {
    console.error("Lỗi gửi OTP:", error);
    throw error;
  }
};
