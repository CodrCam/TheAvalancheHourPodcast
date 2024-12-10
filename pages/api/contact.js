import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Your email address
      pass: process.env.EMAIL_PASS, // App-specific password
    },
  });

  const mailOptions = {
    from: `"${name}" <${email}>`, // Sender's email
    to: 'theavalanchehourpodcast@gmail.com', // Recipient email
    subject: `New Message from ${name}`,
    text: `You have a new message from ${name} (${email}):\n\n${message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Email sent successfully.' });
  } catch (error) {
    console.error('Error sending email:', error.message);
    res.status(500).json({
      error: `Failed to send email. Error: ${error.message}`,
    });
  }
}