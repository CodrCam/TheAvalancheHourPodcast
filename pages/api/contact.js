// pages/api/contact.js
import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_USER = process.env.EMAIL_USER; // Your Gmail address
const EMAIL_PASS = process.env.EMAIL_PASS; // Your Gmail app password
const TO_EMAIL = process.env.CONTACT_EMAIL || 'ct.griffin7@gmail.com'; // Test email, change to theavalanchehourpodcast@gmail.com for production

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, email, message, subject } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Name, email, and message are required.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: EMAIL_USER,
      to: TO_EMAIL,
      subject: subject || `Contact Form: Message from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Contact Details:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Message:</h3>
            <p style="line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">
              <strong>Reply directly to this email to respond to ${name}</strong>
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            This message was sent from the Avalanche Hour Podcast website contact form.
          </p>
        </div>
      `,
      replyTo: email, // Allow direct reply to the sender
    };

    // Send email
    console.log('📧 Sending contact form email...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Contact form email sent successfully');

    // Send confirmation email to user
    const confirmationOptions = {
      from: EMAIL_USER,
      to: email,
      subject: 'Thank you for contacting The Avalanche Hour Podcast',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Thank you for your message!</h2>
          
          <p>Hi ${name},</p>
          
          <p>Thank you for reaching out to The Avalanche Hour Podcast. We've received your message and will get back to you as soon as possible.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your message:</h3>
            <p style="font-style: italic;">"${message.length > 100 ? message.substring(0, 100) + '...' : message}"</p>
          </div>
          
          <p>We typically respond within 24-48 hours. In the meantime, feel free to:</p>
          <ul>
            <li><a href="https://www.theavalanchehour.com/episodes/current">Listen to our latest episodes</a></li>
            <li><a href="https://www.theavalanchehour.com/resources">Check out our resources</a></li>
            <li>Follow us on social media for updates</li>
          </ul>
          
          <p>Best regards,<br>
          The Avalanche Hour Team</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            This is an automated confirmation email. Please do not reply to this message.
          </p>
        </div>
      `
    };

    try {
      await transporter.sendMail(confirmationOptions);
      console.log('✅ Confirmation email sent to user');
    } catch (confirmError) {
      console.error('⚠️ Failed to send confirmation email:', confirmError);
      // Don't fail the main request if confirmation email fails
    }

    res.status(200).json({ 
      success: true, 
      message: 'Message sent successfully! We\'ll get back to you soon.' 
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    
    res.status(500).json({ 
      error: 'Failed to send message',
      message: 'There was an error sending your message. Please try again or email us directly.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}