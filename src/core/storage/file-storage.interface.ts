export interface StoredFileResult {
  filename: string;
  url: string;
  mimetype: string;
  size: number;
}

export interface IFileStorageService {
  uploadFile(file: Express.Multer.File, subfolder?: string): Promise<StoredFileResult>;
  deleteFile(fileUrlOrName: string): Promise<boolean>;
}
