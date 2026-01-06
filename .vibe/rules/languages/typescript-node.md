# 🟢 TypeScript + Node.js Backend 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Express.js 규칙

### 1. 라우터 구조화

```typescript
// ✅ routes/user.routes.ts
import { Router } from 'express';
import { UserController } from '@/controllers/user.controller';
import { authMiddleware } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createUserSchema, updateUserSchema } from '@/schemas/user.schema';

const router = Router();
const controller = new UserController();

router.get('/', controller.findAll);
router.get('/:id', controller.findOne);
router.post('/', validate(createUserSchema), controller.create);
router.put('/:id', authMiddleware, validate(updateUserSchema), controller.update);
router.delete('/:id', authMiddleware, controller.delete);

export default router;
```

### 2. Controller 패턴

```typescript
// ✅ controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '@/services/user.service';
import { CreateUserDto, UpdateUserDto } from '@/dto/user.dto';

export class UserController {
  private userService = new UserService();

  findAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      const users = await this.userService.findAll({
        page: Number(page),
        limit: Number(limit),
      });
      res.json(users);
    } catch (error) {
      next(error);
    }
  };

  findOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreateUserDto = req.body;
      const user = await this.userService.create(dto);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };
}
```

### 3. Service 레이어

```typescript
// ✅ services/user.service.ts
import { prisma } from '@/lib/prisma';
import { CreateUserDto, UpdateUserDto } from '@/dto/user.dto';
import { hashPassword } from '@/utils/crypto';
import { AppError } from '@/utils/errors';

export class UserService {
  async findAll(options: { page: number; limit: number }) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({ skip, take: limit }),
      prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(dto: CreateUserDto) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new AppError('이미 존재하는 이메일입니다', 409);
    }

    const hashedPassword = await hashPassword(dto.password);

    return prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });
  }
}
```

## NestJS 규칙

### 1. Module 구조

```typescript
// ✅ user/user.module.ts
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

### 2. Controller (NestJS)

```typescript
// ✅ user/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/auth/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: '사용자 목록 조회' })
  async findAll(@Query() query: UserQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '사용자 상세 조회' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: '사용자 생성' })
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 수정' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: User,
  ) {
    return this.userService.update(id, dto, user);
  }
}
```

### 3. Service (NestJS)

```typescript
// ✅ user/user.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CreateUserDto, UpdateUserDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async findAll(query: UserQueryDto) {
    return this.userRepository.findAll(query);
  }

  async findById(id: number) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 존재하는 이메일입니다');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
  }
}
```

### 4. DTO와 Validation

```typescript
// ✅ user/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다' })
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다' })
  password: string;

  @ApiProperty({ example: '홍길동' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: '010-1234-5678' })
  @IsOptional()
  @IsString()
  phone?: string;
}
```

## 공통 규칙

### 에러 처리

```typescript
// ✅ utils/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ✅ middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }

  res.status(500).json({
    success: false,
    message: '서버 오류가 발생했습니다',
  });
}
```

### Validation (Zod)

```typescript
// ✅ schemas/user.schema.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('올바른 이메일 형식이 아닙니다'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
    name: z.string().min(1, '이름을 입력해주세요'),
    phone: z.string().optional(),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
```

## 파일 구조

```
src/
├── controllers/        # 라우트 핸들러
├── services/           # 비즈니스 로직
├── repositories/       # 데이터 액세스
├── dto/                # Data Transfer Objects
├── schemas/            # Validation 스키마 (Zod)
├── middleware/         # Express 미들웨어
├── routes/             # 라우터 정의
├── utils/              # 유틸리티
├── types/              # TypeScript 타입
├── config/             # 설정
└── lib/                # 외부 라이브러리 래퍼
```

## 체크리스트

- [ ] Controller → Service → Repository 레이어 분리
- [ ] DTO로 입출력 타입 정의
- [ ] Zod/class-validator로 입력 검증
- [ ] 커스텀 에러 클래스 사용
- [ ] 에러 미들웨어로 중앙 처리
- [ ] `any` 타입 사용 금지
- [ ] async/await + try/catch 또는 에러 미들웨어
