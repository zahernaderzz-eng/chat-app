export interface MessageMetadata {
  // للصور
  width?: number;
  height?: number;
  thumbnail?: string;

  // للملفات
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  // للصوت والفيديو
  duration?: number;

  // للرد
  replyTo?: string;

  // للموقع
  latitude?: number;
  longitude?: number;
}
