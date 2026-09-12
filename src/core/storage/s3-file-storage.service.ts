import { Injectable, NotImplementedException } from '@nestjs/common';
import { IFileStorageService, StoredFileResult } from './file-storage.interface';

@Injectable()
export class S3FileStorageService implements IFileStorageService {
  async uploadFile(file: Express.Multer.File, subfolder: string = 'avatars'): Promise<StoredFileResult> {
    // Adapter stub ready for AWS S3 / Cloudinary credentials integration
    throw new NotImplementedException('خدمة التخزين السحابي S3 تتطلب توفير بيانات الاعتماد في متغيرات البيئة.');
  }

  async deleteFile(fileUrlOrName: string): Promise<boolean> {
    return false;
  }
}
