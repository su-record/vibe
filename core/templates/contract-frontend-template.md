# Frontend Contract Tests: {Feature Name}

**Generated from**: `specs/{feature-name}.md` (Section 6: API Contract)
**Framework**: {Flutter | React | React Native | Vue}
**Language**: {Dart | TypeScript | JavaScript}
**Priority**: {HIGH | MEDIUM | LOW}

---

## Overview

Frontend Contract Testing **validates API contracts from the Consumer perspective**:

- ✅ API requests are sent according to contract
- ✅ API responses follow expected schema
- ✅ Error handling works as per contract
- ✅ Independent testing with mock server

**Consumer-Driven Contract Testing** (Pact pattern)

---

## API Contracts (Consumer View)

### Contract 1: Create Resource

**Consumer Expectation**:

```json
{
  "request": {
    "method": "POST",
    "path": "/api/v1/resource",
    "headers": {
      "Authorization": "Bearer {token}",
      "Content-Type": "application/json"
    },
    "body": {
      "field1": "string",
      "field2": "integer"
    }
  },
  "response": {
    "status": 201,
    "body": {
      "id": "uuid",
      "field1": "string",
      "field2": "integer",
      "createdAt": "datetime"
    }
  }
}
```

---

## Implementation

### Flutter (Dart + http_mock_adapter)

**File**: `test/contract/{feature_name}_contract_test.dart`

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:your_app/services/api_service.dart';
import 'package:your_app/models/resource.dart';

void main() {
  late Dio dio;
  late DioAdapter dioAdapter;
  late ApiService apiService;

  setUp(() {
    dio = Dio(BaseOptions(baseUrl: 'https://api.example.com'));
    dioAdapter = DioAdapter(dio: dio);
    apiService = ApiService(dio: dio);
  });

  group('Create Resource Contract', () {
    test('should match request contract', () async {
      // Arrange: Expected request contract
      final requestBody = {
        'field1': 'test value',
        'field2': 42,
      };

      // Arrange: Mock response matching contract
      final responseBody = {
        'id': '123e4567-e89b-12d3-a456-426614174000',
        'field1': 'test value',
        'field2': 42,
        'createdAt': '2025-01-17T10:00:00Z',
      };

      dioAdapter.onPost(
        '/api/v1/resource',
        (server) => server.reply(201, responseBody),
        data: requestBody,
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        },
      );

      // Act: Call API service
      final result = await apiService.createResource(
        field1: 'test value',
        field2: 42,
        token: 'test-token',
      );

      // Assert: Response matches contract
      expect(result, isA<Resource>());
      expect(result.id, isNotEmpty);
      expect(result.field1, equals('test value'));
      expect(result.field2, equals(42));
      expect(result.createdAt, isA<DateTime>());
    });

    test('should handle error response contract', () async {
      // Arrange: Error response contract
      final errorBody = {
        'error': 'ValidationError',
        'message': 'field1 is required',
        'details': ['field1 must not be empty'],
      };

      dioAdapter.onPost(
        '/api/v1/resource',
        (server) => server.reply(400, errorBody),
      );

      // Act & Assert: Error handling matches contract
      expect(
        () async => await apiService.createResource(
          field1: '',
          field2: 42,
          token: 'test-token',
        ),
        throwsA(isA<ApiException>().having(
          (e) => e.statusCode,
          'status code',
          equals(400),
        )),
      );
    });

    test('should validate response schema', () async {
      // Arrange: Response with invalid schema
      final invalidResponse = {
        'id': 'not-a-uuid',  // Invalid UUID format
        'field1': 123,  // Wrong type
        // Missing field2
      };

      dioAdapter.onPost(
        '/api/v1/resource',
        (server) => server.reply(201, invalidResponse),
      );

      // Act & Assert: Schema validation fails
      expect(
        () async => await apiService.createResource(
          field1: 'test',
          field2: 42,
          token: 'test-token',
        ),
        throwsA(isA<SchemaValidationException>()),
      );
    });
  });

  group('Response Schema Validation', () {
    test('validates UUID format', () {
      final validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(isValidUuid(validUuid), isTrue);

      final invalidUuid = 'not-a-uuid';
      expect(isValidUuid(invalidUuid), isFalse);
    });

    test('validates DateTime format (ISO 8601)', () {
      final validDateTime = '2025-01-17T10:00:00Z';
      expect(() => DateTime.parse(validDateTime), returnsNormally);

      final invalidDateTime = '2025-01-17';  // Missing time
      expect(() => DateTime.parse(invalidDateTime), throwsFormatException);
    });
  });
}

// Helper function
bool isValidUuid(String uuid) {
  final uuidRegex = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  return uuidRegex.hasMatch(uuid);
}
```

**Run**:

```bash
flutter test test/contract/{feature_name}_contract_test.dart
```

---

### React (TypeScript + MSW + Zod)

**File**: `tests/contract/{feature-name}.contract.test.ts`

```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { z } from 'zod';
import { createResource, ApiService } from '@/services/api';

// Zod schemas for contract validation
const CreateResourceRequestSchema = z.object({
  field1: z.string().min(1).max(100),
  field2: z.number().int().nonnegative(),
  field3: z.boolean().optional(),
});

const CreateResourceResponseSchema = z.object({
  id: z.string().uuid(),
  field1: z.string(),
  field2: z.number().int(),
  field3: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.string()).optional(),
});

// Mock server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Create Resource Contract', () => {
  it('should send request matching contract', async () => {
    let capturedRequest: any;

    server.use(
      rest.post('/api/v1/resource', async (req, res, ctx) => {
        capturedRequest = await req.json();

        // Validate request matches contract
        const result = CreateResourceRequestSchema.safeParse(capturedRequest);
        expect(result.success).toBe(true);

        return res(
          ctx.status(201),
          ctx.json({
            id: '123e4567-e89b-12d3-a456-426614174000',
            field1: capturedRequest.field1,
            field2: capturedRequest.field2,
            field3: capturedRequest.field3 ?? false,
            createdAt: new Date().toISOString(),
          })
        );
      })
    );

    const result = await createResource({
      field1: 'test value',
      field2: 42,
      field3: true,
    });

    // Verify request contract
    expect(capturedRequest).toMatchObject({
      field1: 'test value',
      field2: 42,
      field3: true,
    });

    // Verify response contract
    const responseValidation = CreateResourceResponseSchema.safeParse(result);
    expect(responseValidation.success).toBe(true);
  });

  it('should handle error response contract', async () => {
    server.use(
      rest.post('/api/v1/resource', (req, res, ctx) => {
        return res(
          ctx.status(400),
          ctx.json({
            error: 'ValidationError',
            message: 'field1 is required',
            details: ['field1 must not be empty'],
          })
        );
      })
    );

    await expect(
      createResource({
        field1: '',
        field2: 42,
      })
    ).rejects.toThrow();

    // Verify error response matches contract
    try {
      await createResource({ field1: '', field2: 42 });
    } catch (error: any) {
      const errorValidation = ErrorResponseSchema.safeParse(error.response.data);
      expect(errorValidation.success).toBe(true);
      expect(error.response.status).toBe(400);
    }
  });

  it('should reject response with invalid schema', async () => {
    server.use(
      rest.post('/api/v1/resource', (req, res, ctx) => {
        return res(
          ctx.status(201),
          ctx.json({
            id: 'not-a-uuid',  // Invalid UUID
            field1: 123,  // Wrong type
            // Missing field2
          })
        );
      })
    );

    await expect(
      createResource({
        field1: 'test',
        field2: 42,
      })
    ).rejects.toThrow('Schema validation failed');
  });

  it('validates response headers', async () => {
    let responseHeaders: Headers;

    server.use(
      rest.post('/api/v1/resource', (req, res, ctx) => {
        return res(
          ctx.status(201),
          ctx.set('Content-Type', 'application/json'),
          ctx.json({
            id: '123e4567-e89b-12d3-a456-426614174000',
            field1: 'test',
            field2: 42,
            createdAt: new Date().toISOString(),
          })
        );
      })
    );

    const response = await fetch('/api/v1/resource', {
      method: 'POST',
      body: JSON.stringify({ field1: 'test', field2: 42 }),
    });

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('Schema Validation Utilities', () => {
  it('validates UUID format', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const result = z.string().uuid().safeParse(validUuid);
    expect(result.success).toBe(true);

    const invalidUuid = 'not-a-uuid';
    const invalidResult = z.string().uuid().safeParse(invalidUuid);
    expect(invalidResult.success).toBe(false);
  });

  it('validates ISO 8601 datetime', () => {
    const validDate = '2025-01-17T10:00:00Z';
    const result = z.string().datetime().safeParse(validDate);
    expect(result.success).toBe(true);

    const invalidDate = '2025-01-17';  // Missing time
    const invalidResult = z.string().datetime().safeParse(invalidDate);
    expect(invalidResult.success).toBe(false);
  });
});
```

**Run**:

```bash
npm test -- tests/contract/{feature-name}.contract.test.ts
```

---

### React Native (TypeScript + Axios + MockAdapter)

**File**: `__tests__/contract/{feature-name}.contract.test.ts`

```typescript
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { z } from 'zod';
import { ApiService } from '@/services/api';

const mock = new MockAdapter(axios);

const ResponseSchema = z.object({
  id: z.string().uuid(),
  field1: z.string(),
  field2: z.number(),
  createdAt: z.string().datetime(),
});

describe('Create Resource Contract (React Native)', () => {
  beforeEach(() => {
    mock.reset();
  });

  it('should match API contract', async () => {
    const requestBody = {
      field1: 'test value',
      field2: 42,
    };

    const responseBody = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      field1: 'test value',
      field2: 42,
      createdAt: '2025-01-17T10:00:00Z',
    };

    mock.onPost('/api/v1/resource', requestBody).reply(201, responseBody);

    const apiService = new ApiService(axios);
    const result = await apiService.createResource(requestBody);

    // Validate response schema
    const validation = ResponseSchema.safeParse(result);
    expect(validation.success).toBe(true);
  });
});
```

**Run**:

```bash
npm test -- __tests__/contract/
```

---

## Pact Consumer Tests

### Flutter (dart_pact)

**File**: `test/pact/{feature_name}_pact_test.dart`

```dart
import 'package:pact_consumer_dart/pact_consumer_dart.dart';
import 'package:test/test.dart';

void main() {
  late PactMockService mockService;

  setUpAll(() async {
    mockService = PactMockService(
      consumer: 'FrontendApp',
      provider: 'BackendAPI',
      port: 1234,
    );
    await mockService.start();
  });

  tearDownAll(() async {
    await mockService.stop();
  });

  test('create resource contract', () async {
    await mockService
        .given('user is authenticated')
        .uponReceiving('a request to create resource')
        .withRequest(
          method: 'POST',
          path: '/api/v1/resource',
          headers: {'Authorization': 'Bearer token'},
          body: {
            'field1': 'test value',
            'field2': 42,
          },
        )
        .willRespondWith(
          status: 201,
          body: {
            'id': Matchers.uuid,
            'field1': Matchers.string('test value'),
            'field2': Matchers.integer(42),
            'createdAt': Matchers.iso8601DateTime,
          },
        );

    await mockService.run((config) async {
      // Test your API service against mock
      final apiService = ApiService(baseUrl: config.baseUrl);
      final result = await apiService.createResource(
        field1: 'test value',
        field2: 42,
      );

      expect(result.id, isNotEmpty);
    });

    // Pact file generated: pacts/FrontendApp-BackendAPI.json
  });
}
```

---

## CI/CD Integration

```yaml
# .github/workflows/contract-tests.yml
name: Frontend Contract Tests

on: [pull_request]

jobs:
  contract-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.0'

      - name: Run contract tests
        run: flutter test test/contract/

      - name: Run Pact tests
        run: flutter test test/pact/

      - name: Publish Pact
        if: success()
        run: |
          flutter pub global activate pact_broker_cli
          pact-broker publish pacts/ \
            --consumer-app-version=${{ github.sha }} \
            --broker-base-url=${{ secrets.PACT_BROKER_URL }}
```

---

## Best Practices

1. **Use Mock Server**
   - ✅ Independent testing without backend
   - ✅ Immediate detection of contract violations

2. **Schema Validation**
   - ✅ Validate responses with Zod, JSON Schema
   - ✅ Ensure type safety

3. **Consumer-Driven**
   - ✅ Define frontend requirements first
   - ✅ Share Pact files with backend team

4. **CI/CD Automation**
   - ✅ Contract verification on every PR
   - ✅ Central management with Pact Broker

---

## Next Steps

```bash
# 1. Write contract tests
vibe contract "{feature name}" --frontend

# 2. Develop with mock server
flutter test test/contract/ --watch

# 3. Generate and publish Pact
flutter test test/pact/

# 4. Verify contract with backend
vibe verify "{feature name}" --contract
```
