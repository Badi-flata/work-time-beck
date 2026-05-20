import { Test, TestingModule } from '@nestjs/testing';
import { ManagingService } from './managing.service';

describe('ManagingService', () => {
  let service: ManagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManagingService],
    }).compile();

    service = module.get<ManagingService>(ManagingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
