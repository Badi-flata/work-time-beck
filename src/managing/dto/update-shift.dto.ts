import { PartialType } from '@nestjs/swagger';
import { shift } from './shfit.dto';

export class UpdateShiftDto extends PartialType(shift) {}
