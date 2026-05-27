import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty({ message: 'اسم القسم مطلوب' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
