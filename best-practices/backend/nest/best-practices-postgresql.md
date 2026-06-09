# Backend Best Practices — PostgreSQL

> Stack: NestJS v11 · Node.js >= 20 · PostgreSQL · `@nestjs/typeorm` v11 · TypeORM `^0.3` · `@nestjs/jwt` v11 · `@nestjs/passport` v11

All non-database sections (Modules, Controllers, Services, DTOs & Validation, Auth, Error Handling, Configuration, Logging, TypeScript Standards, Security) follow the same rules as the [MongoDB best practices](./best-practices.md). This file covers what differs: the **database layer** and **testing**.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Database & Repositories](#database--repositories)
3. [Testing](#testing)
4. [Performance](#performance)

---

## Project Structure

Replace `schemas/` with `entities/`:

```
src/
├── modules/
│   └── users/
│       ├── dto/
│       │   ├── create-user.dto.ts
│       │   └── update-user.dto.ts
│       ├── entities/
│       │   └── user.entity.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── users.module.ts
│       └── users.service.spec.ts
├── common/
├── config/
│   └── configuration.ts
├── database/
│   └── database.module.ts
├── app.module.ts
└── main.ts
```

- Entities belong to the module that owns them, not a global `entities/` folder.

---

## Database & Repositories

### Connection

- Connect via `TypeOrmModule.forRootAsync()` so `ConfigService` provides all credentials.

```ts
// app.module.ts
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    type: "postgres",
    host: config.get<string>("database.host"),
    port: config.get<number>("database.port"),
    username: config.get<string>("database.user"),
    password: config.get<string>("database.password"),
    database: config.get<string>("database.name"),
    entities: [__dirname + "/**/*.entity{.ts,.js}"],
    synchronize: config.get<string>("app.env") === "development",
    migrations: ["dist/migrations/*.js"],
    migrationsRun: true,
    ssl: config.get<string>("app.env") === "production" ? { rejectUnauthorized: true } : false,
  }),
  inject: [ConfigService],
})
```

Add to the config factory:

```ts
database: {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  name: process.env.DB_NAME,
},
```

### Entity Definition

- Use `@Entity()` / `@Column()` decorators from `typeorm`. Always set explicit column types — never rely on TypeORM inference in production.
- Use `uuid` as the primary key type.

```ts
// entities/user.entity.ts
import { Exclude } from "class-transformer";
import {
  Column, CreateDateColumn, Entity,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  email: string;

  @Column({ type: "varchar" })
  @Exclude()
  passwordHash: string;

  @Column({ type: "varchar", length: 20, default: Role.USER })
  role: Role;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

- Keep entities clean: only persistence concerns (columns, relations, indexes). No business logic.
- Define indexes on the entity, not in migration scripts, unless you need partial or expression indexes:

```ts
@Index(["email"])
@Entity("users")
export class User { ... }
```

### Module Registration

```ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

### Repository Pattern

- Inject via `@InjectRepository(Entity)` typed as `Repository<Entity>`.
- Use the ORM API or `QueryBuilder` for all queries. Never construct raw SQL strings.

```ts
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findAll(filters: UserFilters): Promise<User[]> {
    return this.userRepo.find({
      where: filters,
      select: ["id", "email", "role", "createdAt"],
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({ ...dto, passwordHash });
    return this.userRepo.save(user);
  }
}
```

- For complex queries, use `createQueryBuilder`. Name all aliases explicitly:

```ts
const users = await this.userRepo
  .createQueryBuilder("user")
  .leftJoinAndSelect("user.profile", "profile")
  .where("user.isActive = :isActive", { isActive: true })
  .orderBy("user.createdAt", "DESC")
  .getMany();
```

### Transactions

- Wrap multi-step writes in a `DataSource` transaction. Never use `EntityManager` directly in services outside of a transaction callback.

```ts
await this.dataSource.transaction(async (manager) => {
  const passwordHash = await bcrypt.hash(dto.password, 12);
  const user = manager.create(User, { ...dto, passwordHash });
  await manager.save(user);
  await manager.save(AuditLog, { userId: user.id, action: "user.created" });
});
```

### Migrations

- **Never use `synchronize: true` in production.** It can silently drop columns and destroy data when entities change.
- Generate migrations with the TypeORM CLI after every entity change:

```bash
npx typeorm migration:generate src/migrations/UserAddRole -d dist/data-source.js
npx typeorm migration:run -d dist/data-source.js
```

- Keep a `data-source.ts` at the project root for the TypeORM CLI:

```ts
// data-source.ts
import { DataSource } from "typeorm";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: ["src/**/*.entity.ts"],
  migrations: ["src/migrations/*.ts"],
});
```

- Review every generated migration before running it. TypeORM may generate `DROP COLUMN` on a rename — handle renames manually.

---

## Testing

### Unit Tests

- Mock TypeORM repositories using `getRepositoryToken(Entity)` — the TypeORM equivalent of Mongoose's `getModelToken`.

```ts
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";

describe("UsersService", () => {
  let service: UsersService;
  let userRepo: jest.Mocked<Repository<User>>;

  const mockUserRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => jest.clearAllMocks());

  it("throws NotFoundException when user does not exist", async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.findById("non-existent-id")).rejects.toThrow(NotFoundException);
  });
});
```

### E2E Tests

- Use `@nestjs/testing` + `supertest` + a **dedicated test PostgreSQL database**. Never run against the development or production database.
- Run migrations before the test suite and truncate tables between tests — do not use `synchronize: true` in the test config.

```ts
// test/users.e2e-spec.ts
describe("UsersController (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => ({
          "database.host": process.env.TEST_DB_HOST ?? "localhost",
          "database.port": 5432,
          "database.user": process.env.TEST_DB_USER,
          "database.password": process.env.TEST_DB_PASSWORD,
          "database.name": process.env.TEST_DB_NAME,
          "app.env": "test",
        }[key]),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await dataSource.runMigrations();
  });

  afterEach(async () => {
    // Truncate in reverse FK order
    await dataSource.query(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  it("POST /users — creates a user and returns 201", () => {
    return request(app.getHttpServer())
      .post("/users")
      .send({ email: "test@example.com", password: "password123" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.email).toBe("test@example.com");
        expect(body.passwordHash).toBeUndefined();
      });
  });
});
```

- Apply the same global pipes and interceptors in the test app as in production.
- Use a `.env.test` file for test database credentials. Load it in Jest config via `dotenv`.

```js
// jest.config.js
module.exports = {
  setupFiles: ["dotenv/config"],
  // dotenv loads .env.test when NODE_ENV=test
};
```

### Rules

- Do not test NestJS internals (routing, DI wiring). Test your code's behaviour.
- Test all happy paths and all explicitly handled error paths.
- Name tests as readable sentences: `it("returns 404 when user is not found")`.

---

## Performance

- Use `select` to fetch only required columns on list endpoints:

```ts
const users = await this.userRepo.find({
  select: ["id", "email", "role"],
  where: { isActive: true },
});
```

- Add indexes on all columns used in `WHERE`, `JOIN`, or `ORDER BY`. For composite queries, use composite indexes.
- Paginate all list endpoints. Never return an unbounded result set:

```ts
const [users, total] = await this.userRepo.findAndCount({
  take: limit,
  skip: (page - 1) * limit,
  order: { createdAt: "DESC" },
});
```

- Cache expensive, rarely-changing reads with `@nestjs/cache-manager` v3 (see main best-practices.md for setup).
- Enable SSL in production connections (see Connection section above).
- Use connection pooling defaults from TypeORM — tune `extra.max` (pool size) based on Postgres `max_connections`.
