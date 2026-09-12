import { Injectable } from '@nestjs/common';
import { IFileStorageService, StoredFileResult } from './file-storage.interface';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

@Injectable()
export class LocalFileStorageService implements IFileStorageService {
  private baseUploadDir = join(process.cwd(), 'uploads');

  constructor() {
    if (!existsSync(this.baseUploadDir)) {
      mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File, subfolder: string = 'avatars'): Promise<StoredFileResult> {
    const targetDir = join(this.baseUploadDir, subfolder);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const ext = file.originalname.split('.').pop() || 'png';
    const filename = `${randomUUID()}.${ext}`;
    const targetPath = join(targetDir, filename);

    writeFileSync(targetPath, file.buffer);

    return {
      filename,
      url: `/uploads/${subfolder}/${filename}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async deleteFile(fileUrlOrName: string): Promise<boolean> {
    try {
      const cleanPath = fileUrlOrName.replace(/^\/uploads\//, '');
      const fullPath = join(this.baseUploadDir, cleanPath);
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
