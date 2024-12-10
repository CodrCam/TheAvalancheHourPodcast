import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
      },
    });

    const mailOptions = {
      from: email, // Sender's email
      to: 'theavalanchehourpodcast@gmail.com', // Recipient email
      subject: `New Message from ${name}`,
      text: `You have a new message from ${name} (${email}):\n\n${message}`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ message: 'Email sent successfully.' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ error: 'Failed to send email.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}