const nodemailer = require("nodemailer");
const sendEmail = (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAILER_HOST,
    port: process.env.MAILER_PORT,
    secure: true,
    auth: {
      user: process.env.MAILER_USER,
      password: process.env.MAILER_PASSWORD,
    },
  });
  const mailOptions = {
    from: "BeMazady",
    to: options.email,
    subject: options.subject,
    text: options.message,
  };
};
module.exports = sendEmail;
