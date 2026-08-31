import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAvatarDto {
  @ApiProperty({
    description: 'رابط الصورة الشخصية الجديد للمستخدم أو مسار الملف',
    example: '/uploads/avatars/avatar-123.webp',
  })
  @IsNotEmpty({ message: 'رابط الصورة مطلوب' })
  @IsString({ message: 'يجب أن يكون رابط الصورة نصاً صالحاً' })
  imageProfile: string;
}
