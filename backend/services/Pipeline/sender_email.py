import os
import smtplib
from email.message import EmailMessage

def enviar_correo(destinatario: str, asunto: str, cuerpo: str):
    remitente = os.getenv("EMAIL_USER")
    password = os.getenv("EMAIL_PASS")

    if not remitente or not password:
        return

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = remitente
    msg["To"] = destinatario
    msg.set_content(cuerpo)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(remitente, password)
            smtp.send_message(msg)
        print(f"Correo enviado a {destinatario}")
    except Exception as e:
        print(f" Error enviando correo a {destinatario}: {e}")
        
        
        
