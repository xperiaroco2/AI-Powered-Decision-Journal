import { Test, TestingModule } from '@nestjs/testing';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';

describe('DecisionsController', () => {
  let controller: DecisionsController;
  let decisionsService: DecisionsService;

  const mockDecisionsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    rerun: jest.fn(),
  };

  const mockUser = {
    id: 'user-id-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DecisionsController],
      providers: [
        {
          provide: DecisionsService,
          useValue: mockDecisionsService,
        },
      ],
    }).compile();

    controller = module.get<DecisionsController>(DecisionsController);
    decisionsService = module.get<DecisionsService>(DecisionsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all decisions for the current user', async () => {
      const mockDecisions = [
        {
          id: 'decision-1',
          userId: mockUser.id,
          situation: 'Test situation 1',
          chosenDecision: 'Test decision 1',
          createdAt: new Date(),
        },
        {
          id: 'decision-2',
          userId: mockUser.id,
          situation: 'Test situation 2',
          chosenDecision: 'Test decision 2',
          createdAt: new Date(),
        },
      ];

      mockDecisionsService.findAll.mockResolvedValue(mockDecisions);

      const result = await controller.findAll(mockUser);

      expect(decisionsService.findAll).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockDecisions);
    });
  });

  describe('findOne', () => {
    it('should return a single decision', async () => {
      const decisionId = 'decision-id-123';
      const mockDecision = {
        id: decisionId,
        userId: mockUser.id,
        situation: 'Test situation',
        chosenDecision: 'Test decision',
        latestRun: { id: 'run-1', status: 'DONE' },
        runs: [{ id: 'run-1', status: 'DONE' }],
      };

      mockDecisionsService.findOne.mockResolvedValue(mockDecision);

      const result = await controller.findOne(decisionId, mockUser);

      expect(decisionsService.findOne).toHaveBeenCalledWith(
        decisionId,
        mockUser.id,
      );
      expect(result).toEqual(mockDecision);
    });
  });

  describe('create', () => {
    it('should create a new decision', async () => {
      const createDecisionDto: CreateDecisionDto = {
        situation: 'Should I change careers?',
        chosenDecision: 'Yes, I will change careers',
        personalReasoning: 'I want better work-life balance',
      };

      const mockDecision = {
        id: 'decision-id-123',
        userId: mockUser.id,
        ...createDecisionDto,
        status: 'PENDING',
        createdAt: new Date(),
      };

      mockDecisionsService.create.mockResolvedValue(mockDecision);

      const result = await controller.create(createDecisionDto, mockUser);

      expect(decisionsService.create).toHaveBeenCalledWith(
        mockUser.id,
        createDecisionDto,
      );
      expect(result).toEqual(mockDecision);
    });
  });

  describe('rerun', () => {
    it('should create a new analysis run for existing decision', async () => {
      const decisionId = 'decision-id-123';
      const mockResult = {
        message: 'Analysis re-run started',
        runId: 'new-run-id',
        status: 'PENDING',
      };

      mockDecisionsService.rerun.mockResolvedValue(mockResult);

      const result = await controller.rerun(decisionId, mockUser);

      expect(decisionsService.rerun).toHaveBeenCalledWith(
        decisionId,
        mockUser.id,
      );
      expect(result).toEqual(mockResult);
    });
  });
});

