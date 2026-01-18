"""
Email service for sending notifications.
Uses SMTP for simplicity (works with Gmail, SendGrid SMTP, etc.)
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Simple SMTP email service for event notifications."""
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.email_from = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
    
    @property
    def is_configured(self) -> bool:
        """Check if email service is properly configured."""
        return all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password,
            self.email_from
        ])
    
    def _send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> bool:
        """Send an email using SMTP."""
        if not self.is_configured:
            logger.warning("Email service not configured. Skipping email send.")
            return False
        
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.email_from}>"
            msg["To"] = to_email
            
            # Add plain text version if provided
            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            
            # Add HTML version
            msg.attach(MIMEText(html_content, "html"))
            
            # Connect and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.email_from, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_registration_confirmation(self, user_email: str, user_name: str, event_title: str, event_date: str, event_location: Optional[str] = None) -> bool:
        """Send email confirmation after successful registration."""
        subject = f"Registration Confirmed: {event_title}"
        
        location_info = f"<p><strong>Location:</strong> {event_location}</p>" if event_location else ""
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4f46e5;">Registration Confirmed! 🎉</h2>
                <p>Hi {user_name},</p>
                <p>You have successfully registered for:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #1f2937;">{event_title}</h3>
                    <p style="margin: 5px 0;"><strong>Date:</strong> {event_date}</p>
                    {location_info}
                </div>
                <p>We'll send you a reminder 24 hours before the event.</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(user_email, subject, html_content)
    
    def send_waitlist_notification(self, user_email: str, user_name: str, event_title: str, position: int) -> bool:
        """Send notification when user is added to waitlist."""
        subject = f"Waitlisted: {event_title}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #f59e0b;">You're on the Waitlist</h2>
                <p>Hi {user_name},</p>
                <p>The event <strong>{event_title}</strong> is currently at capacity.</p>
                <p>You are <strong>#{position}</strong> on the waitlist. We'll notify you immediately if a spot becomes available!</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(user_email, subject, html_content)
    
    def send_waitlist_promotion(self, user_email: str, user_name: str, event_title: str, event_date: str) -> bool:
        """Send notification when user is promoted from waitlist to registered."""
        subject = f"🎉 Good news! You're registered for {event_title}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981;">Great News! 🎉</h2>
                <p>Hi {user_name},</p>
                <p>A spot has opened up! You have been moved from the waitlist to <strong>registered</strong> for:</p>
                <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #065f46;">{event_title}</h3>
                    <p style="margin: 10px 0 0 0;"><strong>Date:</strong> {event_date}</p>
                </div>
                <p>We look forward to seeing you there!</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(user_email, subject, html_content)
    
    def send_event_reminder(self, user_email: str, user_name: str, event_title: str, event_date: str, event_location: Optional[str] = None, online_link: Optional[str] = None) -> bool:
        """Send reminder 24 hours before event starts."""
        subject = f"Reminder: {event_title} starts tomorrow!"
        
        location_html = ""
        if event_location:
            location_html = f"<p><strong>Location:</strong> {event_location}</p>"
        if online_link:
            location_html += f"<p><strong>Join Link:</strong> <a href='{online_link}'>{online_link}</a></p>"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4f46e5;">Event Reminder ⏰</h2>
                <p>Hi {user_name},</p>
                <p>This is a friendly reminder that your event is coming up tomorrow!</p>
                <div style="background: #ede9fe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #5b21b6;">{event_title}</h3>
                    <p style="margin: 5px 0;"><strong>When:</strong> {event_date}</p>
                    {location_html}
                </div>
                <p>We look forward to seeing you there!</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(user_email, subject, html_content)
    
    def send_event_cancellation(self, user_email: str, user_name: str, event_title: str, reason: Optional[str] = None) -> bool:
        """Send notification when event is cancelled."""
        subject = f"Event Cancelled: {event_title}"
        
        reason_html = f"<p><strong>Reason:</strong> {reason}</p>" if reason else ""
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #ef4444;">Event Cancelled</h2>
                <p>Hi {user_name},</p>
                <p>We're sorry to inform you that the following event has been cancelled:</p>
                <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #991b1b;">{event_title}</h3>
                    {reason_html}
                </div>
                <p>We apologize for any inconvenience. Check out our other upcoming events!</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(user_email, subject, html_content)
    
    def send_event_approved(self, organizer_email: str, organizer_name: str, event_title: str) -> bool:
        """Send notification to organizer when their event is approved."""
        subject = f"Event Approved: {event_title}"
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981;">Event Approved! ✅</h2>
                <p>Hi {organizer_name},</p>
                <p>Great news! Your event has been approved and is now visible to the community:</p>
                <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin: 0; color: #065f46;">{event_title}</h3>
                </div>
                <p>Users can now register for your event. Good luck!</p>
                <p>Best regards,<br>The Alumni Network Team</p>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(organizer_email, subject, html_content)


# Singleton instance
email_service = EmailService()
