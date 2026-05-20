import { Test, TestingModule } from '@nestjs/testing';
import { ManagingController } from './managing.controller';
import { ManagingService } from './managing.service';

describe('ManagingController', () => {
  let controller: ManagingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagingController],
      providers: [ManagingService],
    }).compile();

    controller = module.get<ManagingController>(ManagingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
