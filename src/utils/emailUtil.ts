import nodemailer from "nodemailer";

export class EmailUtil {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtphz.qiye.163.com", // SMTP 服务器地址
      port: 465, // SMTP 端口（587 是常用的 TLS 端口）
      secure: true, // 如果使用 465 端口，则设置为 true
      auth: {
        user: process.env.EMAIL_USER, // 邮箱地址
        pass: process.env.EMAIL_PASS, // 邮箱密码
      },
      tls: {
        rejectUnauthorized: false, // 允许自签名证书
      },
    });
  }

  async sendVerificationEmail(
    to: string,
    verificationCode: string
  ): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: "Ai Master Email Verification",
      html: `
        <h3>Thank you for registering for Ai Master</h1>
        <p>您的验证码是: <strong>${verificationCode}</strong></p>
        <p>Please click the link below to verify your email:</p>
        <a href="http://aiia.cc/verify-email?code=${verificationCode}&email=${to}">
          Verify Email
        </a>
        <p>If you did not request this, please ignore this email.</p>
        <footer>
          <p>&copy; 2024 Ai Master. All rights reserved.</p>
        </footer>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }
}
