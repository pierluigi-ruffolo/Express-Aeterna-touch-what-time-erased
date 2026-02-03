import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.ML_HOST,
  port: process.env.ML_PORT,
  auth: {
    user: process.env.ML_USER,
    pass: process.env.ML_PASS,
  },
});

export default transporter;
