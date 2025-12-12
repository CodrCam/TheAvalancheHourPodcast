// pages/api/contact.js
import nodemailer from 'nodemailer';

// Email configuration from environment variables
const EMAIL_USER = process.env.EMAIL_USER; // Your Gmail address
const EMAIL_PASS = process.env.EMAIL_PASS; // Your Gmail app password
const TO_EMAIL = process.env.CONTACT_EMAIL || 'theavalanchehourpodcast@gmail.com';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const {
      name,
      email,
      message,
      subject,
      isSponsorship,
      companyName,
      sponsorshipBudget,
      sponsorshipGoals
    } = req.body;

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
        pass: EMAIL_PASS
      }
    });

    // Determine email subject and content based on inquiry type
    const emailSubject = isSponsorship
      ? `🎯 SPONSORSHIP INQUIRY: ${companyName || name}`
      : (subject || `Contact Form: Message from ${name}`);

    // Email content for the podcast team
    const mailOptions = {
      from: EMAIL_USER,
      to: TO_EMAIL,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          ${isSponsorship ? `
            <div style="background-color: #4caf50; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">
                💼 Sponsorship Inquiry
              </h1>
            </div>
          ` : `
            <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 8px; margin-bottom: 16px;">
              New Contact Form Submission
            </h2>
          `}
          
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0; color: #333;">Contact Details:</h3>
            <p style="margin: 0 0 4px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 0 0 4px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${isSponsorship && companyName ? `<p style="margin: 0 0 4px 0;"><strong>Company:</strong> ${companyName}</p>` : ''}
            <p style="margin: 0 0 4px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            <p style="margin: 0;"><strong>Inquiry Type:</strong> ${isSponsorship ? '🎯 Sponsorship' : '📧 General'}</p>
          </div>
          
          ${isSponsorship ? `
            <div style="background-color: #e8f5e9; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #2e7d32;">Sponsorship Information:</h3>
              ${sponsorshipBudget ? `<p style="margin: 0 0 4px 0;"><strong>Budget Range:</strong> ${sponsorshipBudget}</p>` : ''}
              ${sponsorshipGoals ? `
                <p style="margin: 8px 0 4px 0;"><strong>Marketing Goals & Target Audience:</strong></p>
                <p style="line-height: 1.5; white-space: pre-wrap; background-color: white; padding: 12px; border-radius: 5px; margin: 0;">
                  ${sponsorshipGoals}
                </p>
              ` : ''}
            </div>
          ` : ''}
          
          <div style="background-color: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">Message:</h3>
            <p style="line-height: 1.5; white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
          
          ${isSponsorship ? `
            <div style="margin-top: 16px; padding: 16px; background-color: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
              <h4 style="margin-top: 0; color: #e65100;">📋 Suggested Next Steps:</h4>
              <ol style="margin: 8px 0; padding-left: 20px;">
                <li>Send media kit with audience demographics</li>
                <li>Provide download statistics and analytics</li>
                <li>Share sponsorship package options</li>
                <li>Schedule a call to discuss custom solutions</li>
              </ol>
              <p style="margin: 0; font-weight: bold; color: #e65100;">
                ⚡ Priority: Respond within 2–3 business days with media kit
              </p>
            </div>
          ` : ''}
          
          <div style="margin-top: 16px; padding: 12px; background-color: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; color: #1976d2; font-size: 14px;">
              <strong>Reply directly to this email to respond to ${name}</strong>
            </p>
          </div>
          
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px; margin: 0 0 4px 0; text-align: center;">
            This message was sent from the Avalanche Hour Podcast website contact form.
            ${isSponsorship ? ' This is a sponsorship inquiry - please prioritize response.' : ''}
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

    // Send email to podcast team
    console.log(`📧 Sending ${isSponsorship ? 'sponsorship' : 'contact'} form email...`);
    await transporter.sendMail(mailOptions);
    console.log(`✅ ${isSponsorship ? 'Sponsorship' : 'Contact'} form email sent successfully`);

    // Build confirmation body based on type, using YOUR exact copy
    const instagramFooter = `
      <br><br>
      <span style="font-size: 12px; color: #666;">
        Follow us on Instagram:
        <a href="https://www.instagram.com/theavalanchehourpodcast/" style="color: #1976d2; text-decoration: none; margin-left: 4px;">
          @theavalanchehourpodcast
        </a>
      </span>
    `;

    let confirmationHtmlBody;

    if (isSponsorship) {
      // SPONSOR CONFIRMATION – exact copy, compact HTML
      confirmationHtmlBody = `
        Hello ${name},<br><br>
        Thank you for your interest in partnering with The Avalanche Hour Podcast. We will send our media kit and detailed audience analytics within 2–3 business days and will follow up with next steps.<br><br>
        If you have any questions in the meantime, you can reply directly to this email.<br><br>
        Sincerely,<br>
        The Avalanche Hour Team
        ${instagramFooter}
      `;
    } else {
      // LISTENER CONFIRMATION – exact copy, compact HTML
      confirmationHtmlBody = `
        Hello ${name}<br><br>
        Thank you for your submission to the Avalanche Hour Podcast. We have received your message.<br><br>
        Our goal is to make this platform a meaningful resource for our community, and we appreciate your input. During peak season there may be a delay in response.<br><br>
        If you have anything additional to add, you can reply directly to this email.<br><br>
        Sincerely,<br>
        The Avalanche Hour Team
        ${instagramFooter}
      `;
    }

    // Send confirmation email to user
    const confirmationOptions = {
      from: EMAIL_USER,
      to: email,
      subject: isSponsorship
        ? 'Sponsorship Inquiry Received - The Avalanche Hour Podcast'
        : 'Thank you for contacting The Avalanche Hour Podcast',
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
      console.log('✅ Confirmation email sent to user');
    } catch (confirmError) {
      console.error('⚠️ Failed to send confirmation email:', confirmError);
      // Don't fail the main request if confirmation email fails
    }

    res.status(200).json({
      success: true,
      message: isSponsorship
        ? 'Sponsorship inquiry received! We\'ll send you our media kit within 2–3 business days.'
        : 'Message sent successfully! We\'ve received your submission.'
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