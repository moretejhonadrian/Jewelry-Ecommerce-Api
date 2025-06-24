import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const aesKey = Buffer.from(process.env.AES_SECRET_KEY!, 'base64');
//const aesKey = Buffer.from("Sgm6F6zpF2h8hgp68ii3zzyVVruVCxDsjhQjDugkS40=", 'base64');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(aesKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(aesKey), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}