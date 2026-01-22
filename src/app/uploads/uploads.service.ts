import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

const sharp = require('sharp');

@Injectable()
export class UploadsService {
  private baseUrl: string;
  private uploadsPath: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:4000';
    this.uploadsPath = path.join(process.cwd(), 'uploads');
  }

  async processImage(file: Express.Multer.File, userId: string) {
    const metadata = await sharp(file.path).metadata();

    const thumbnailName = `thumb_${file.filename}`;
    const thumbnailPath = path.join(path.dirname(file.path), thumbnailName);

    await sharp(file.path)
      .resize(200, 200, { fit: 'cover' })
      .toFile(thumbnailPath);

    return {
      url: `${this.baseUrl}/uploads/images/${file.filename}`,
      thumbnail: `${this.baseUrl}/uploads/images/${thumbnailName}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      width: metadata.width,
      height: metadata.height,
    };
  }

  async processDocument(file: Express.Multer.File, userId: string) {
    return {
      url: `${this.baseUrl}/uploads/documents/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async processAudio(file: Express.Multer.File, userId: string) {
    return {
      url: `${this.baseUrl}/uploads/audio/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      duration: null,
    };
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const urlPath = new URL(fileUrl).pathname;
      // urlPath = /uploads/images/abc123.jpg

      const filePath = path.join(process.cwd(), urlPath);
      // filePath = /app/uploads/images/abc123.jpg

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
      }

      if (urlPath.includes('/images/')) {
        const dir = path.dirname(filePath);
        const filename = path.basename(filePath);
        const thumbnailPath = path.join(dir, `thumb_${filename}`);

        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
          console.log(`Deleted thumbnail: ${thumbnailPath}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }
}
