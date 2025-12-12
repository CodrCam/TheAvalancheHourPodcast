// pages/api/guest-application.js
import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_USER = process.env.EMAIL_USER; // Your Gmail address
const EMAIL_PASS = process.env.EMAIL_PASS; // Your Gmail app password
const TO_EMAIL = process.env.CONTACT_EMAIL || 'theavalanchehourpodcast@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, email, background, topics, contact } = req.body;

    // Basic validation – guest app needs at least name, email, and background
    if (!name || !email || !background) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Name, email, and background are required.'
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
        pass: EMAIL_PASS
      }
    });

    // Email to podcast team with guest details
    const mailOptions = {
      from: EMAIL_USER,
      to: TO_EMAIL,
      subject: `🎙️ Guest Application: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 8px; margin-bottom: 16px;">
            New Guest Application
          </h2>
          
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0; color: #333;">Applicant Details:</h3>
            <p style="margin: 0 0 4px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 0 0 4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p style="margin: 0 0 4px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin-top: 0; color: #333;">Background</h3>
            <p style="margin: 0; line-height: 1.5; white-space: pre-wrap;">${background}</p>
          </div>

          ${topics ? `
            <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px;">
              <h3 style="margin-top: 0; color: #333;">Topics / Story Ideas</h3>
              <p style="margin: 0; line-height: 1.5; white-space: pre-wrap;">${topics}</p>
            </div>
          ` : ''}

          ${contact ? `
            <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 16px;">
              <h3 style="margin-top: 0; color: #333;">Best Way to Reach / Availability</h3>
              <p style="margin: 0; line-height: 1.5; white-space: pre-wrap;">${contact}</p>
            </div>
          ` : ''}

          <div style="margin-top: 16px; padding: 12px; background-color: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">
              <strong>Reply directly to this email to respond to ${name}</strong>
            </p>
          </div>

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px; margin: 0 0 4px 0; text-align: center;">
            This message was sent from the Avalanche Hour Podcast "Be a Guest" form.
          </p>
          <p style="color: #666; font-size: 12px; margin: 0; text-align: center;">
            Follow us on Instagram:
            <a 
              href="https://www.instagram.com/theavalanchehourpodcast/" 
              style="color: #1976d2; text-decoration: none; margin-left: 4px;"
            >
              @theavalanchehourpodcast
            </a>
          </p>
        </div>
      `,
      replyTo: email
    };

    console.log('📧 Sending guest application email...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Guest application email sent successfully');

    // Guest confirmation – exact copy, compact HTML with single line breaks
    const instagramFooter = `
      <br><br>
      <span style="font-size: 12px; color: #666;">
        Follow us on Instagram:
        <a href="https://www.instagram.com/theavalanchehourpodcast/" style="color: #1976d2; text-decoration: none; margin-left: 4px;">
          @theavalanchehourpodcast
        </a>
      </span>
    `;

    const confirmationHtmlBody = `
      Hello ${name}<br><br>
      Thank you for your submission to The Avalanche Hour Podcast. Our goal is to make this platform a meaningful resource for our community, and we appreciate your input.<br><br>
      Your submission has been added to our guest list cache. We begin our planning for each season during the summer, and will contact you if we have an available slot.<br><br>
      If you have any questions or comments, you can reply directly to this email.<br><br>
      Sincerely,<br>
      The Avalanche Hour Team
      ${instagramFooter}
    `;

    const confirmationOptions = {
      from: EMAIL_USER,
      to: email,
      subject: 'Guest Submission Received - The Avalanche Hour Podcast',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.5;">
          <p style="margin: 0;">
            ${confirmationHtmlBody}
          </p>
        </div>
      `
    };

    try {
      await transporter.sendMail(confirmationOptions);
      console.log('✅ Guest confirmation email sent to user');
    } catch (confirmError) {
      console.error('⚠️ Failed to send guest confirmation email:', confirmError);
      // Don't fail the main request if confirmation email fails
    }

    res.status(200).json({
      success: true,
      message: 'Guest application received! Your submission has been added to our guest list cache.'
    });

  } catch (error) {
    console.error('❌ Guest application error:', error);

    res.status(500).json({
      error: 'Failed to submit application',
      message: 'There was an error submitting your application. Please try again or email us directly.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}