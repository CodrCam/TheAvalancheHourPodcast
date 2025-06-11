// pages/api/guest-application.js - Simplified version
import nodemailer from 'nodemailer';

// For testing purposes, we'll create a test account if Gmail fails
async function createTestAccount() {
  try {
    const testAccount = await nodemailer.createTestAccount();
    return {
      user: testAccount.user,
      pass: testAccount.pass,
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false
      }
    };
  } catch (error) {
    console.error('Failed to create test account:', error);
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { name, email, background, topics, contact } = req.body;

    // Basic validation - only require the essentials
    if (!name || !email || !background) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Name, email, and background information are required.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Try Gmail first, fall back to test account
    let transporter;
    let emailConfig;

    // Option 1: Try Gmail if credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      console.log('🔧 Attempting Gmail configuration...');
      try {
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        // Test the connection
        await transporter.verify();
        console.log('✅ Gmail connection successful');
        
        emailConfig = {
          to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER,
          from: process.env.EMAIL_USER
        };
      } catch (gmailError) {
        console.log('❌ Gmail failed, trying test account...', gmailError.message);
        transporter = null;
      }
    }

    // Option 2: Use test account if Gmail fails
    if (!transporter) {
      console.log('🧪 Creating test email account...');
      const testConfig = await createTestAccount();
      
      if (!testConfig) {
        throw new Error('Failed to create test email account');
      }

      transporter = nodemailer.createTransport({
        host: testConfig.smtp.host,
        port: testConfig.smtp.port,
        secure: testConfig.smtp.secure,
        auth: {
          user: testConfig.user,
          pass: testConfig.pass,
        },
      });

      emailConfig = {
        to: testConfig.user,
        from: testConfig.user
      };

      console.log('✅ Test account created:', testConfig.user);
    }

    // Email content for the podcast team
    const mailOptions = {
      from: emailConfig.from,
      to: emailConfig.to,
      subject: `🎙️ Guest Application: ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
          <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
            🎙️ New Guest Application
          </h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Contact Information:</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Background & Bio:</h3>
            <p style="line-height: 1.6; white-space: pre-wrap;">${background}</p>
          </div>
          
          ${topics ? `
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2e7d32;">Discussion Topics:</h3>
            <p style="line-height: 1.6; white-space: pre-wrap;">${topics}</p>
          </div>
          ` : ''}
          
          ${contact ? `
          <div style="background-color: #e1f5fe; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0277bd;">Contact & Availability:</h3>
            <p style="line-height: 1.6; white-space: pre-wrap;">${contact}</p>
          </div>
          ` : ''}
          
          <div style="margin-top: 30px; padding: 20px; background-color: #e3f2fd; border-radius: 8px; border-left: 4px solid #1976d2;">
            <p style="margin: 0; color: #1976d2; font-weight: bold;">
              📞 Next Steps: Reply to this email to reach out to ${name}
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px; text-align: center;">
            This application was submitted through the Avalanche Hour Podcast guest application form.
          </p>
        </div>
      `,
      replyTo: email,
    };

    // Send email to podcast team
    console.log('📧 Sending guest application email...');
    const info = await transporter.sendMail(mailOptions);

    // Send confirmation email to applicant
    const confirmationOptions = {
      from: emailConfig.from,
      to: email,
      subject: 'Thanks for applying - The Avalanche Hour Podcast',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">🎙️ Thanks for your guest application!</h2>
          
          <p>Hi ${name},</p>
          
          <p>Thank you for your interest in being a guest on The Avalanche Hour Podcast! We've received your application and are excited to learn more about your background and expertise.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">What happens next?</h3>
            <ol style="line-height: 1.6;">
              <li><strong>Review:</strong> Our team will review your application within 1-2 weeks</li>
              <li><strong>Contact:</strong> If selected, we'll reach out to discuss potential topics</li>
              <li><strong>Recording:</strong> We'll schedule a recording session that works for you</li>
            </ol>
          </div>
          
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>💡 Tip:</strong> While you wait, check out our recent episodes to get a feel for our conversation style!</p>
          </div>
          
          <p>We appreciate you taking the time to share your expertise with our community. The avalanche and snow science world thrives on shared knowledge and experiences like yours.</p>
          
          <p>Best regards,<br>
          The Avalanche Hour Team</p>
          
          <div style="margin-top: 30px; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
            <p style="margin: 0; text-align: center;">
              <a href="https://www.theavalanchehour.com/episodes/current" style="color: #1976d2; text-decoration: none; font-weight: bold;">🎧 Listen to Recent Episodes</a>
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">
            Have questions? Just reply to this email and we'll get back to you!
          </p>
        </div>
      `
    };

    try {
      await transporter.sendMail(confirmationOptions);
      console.log('✅ Confirmation email sent to applicant');
    } catch (confirmError) {
      console.error('⚠️ Failed to send confirmation email:', confirmError);
      // Don't fail the main request if confirmation email fails
    }

    if (info.messageId && info.messageId.includes('ethereal')) {
      console.log('🧪 Test guest application sent! Preview URL:', nodemailer.getTestMessageUrl(info));
      
      return res.status(200).json({ 
        success: true, 
        message: 'Test application submitted! Check the console for preview link.',
        previewUrl: nodemailer.getTestMessageUrl(info)
      });
    } else {
      console.log('✅ Gmail guest application sent successfully');
      return res.status(200).json({ 
        success: true, 
        message: 'Application submitted successfully! We\'ll review it and get back to you soon.' 
      });
    }

  } catch (error) {
    console.error('❌ Guest application error:', error);
    
    res.status(500).json({ 
      error: 'Failed to submit application',
      message: 'There was an error submitting your application. Please try again or email us directly.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}