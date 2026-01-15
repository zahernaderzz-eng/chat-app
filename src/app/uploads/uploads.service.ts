// uploads/uploads.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:4000';
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
}
