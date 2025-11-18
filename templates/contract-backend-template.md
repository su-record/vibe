# Backend Contract Tests: {기능명}

**Generated from**: `specs/{기능명}.md` (Section 6: API 계약)
**Framework**: {FastAPI | Django | Express | NestJS}
**Language**: {Python | TypeScript | JavaScript}
**Priority**: {HIGH | MEDIUM | LOW}

---

## Overview

Contract Testing은 **API 계약(스키마)을 검증**합니다:
- ✅ Request/Response 스키마 준수
- ✅ 상태 코드 일치
- ✅ 헤더 검증
- ✅ 데이터 타입 및 필수 필드 확인

**Consumer → Provider 계약 보장** (Pact 패턴)

---

## API Contracts

### Contract 1: {엔드포인트 이름}

**Endpoint**: `POST /api/v1/{resource}`
**Mapped to**: REQ-001 in SPEC

#### Request Contract

```json
{
  "method": "POST",
  "path": "/api/v1/{resource}",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {token}"
  },
  "body": {
    "field1": "string (required)",
    "field2": "integer (required)",
    "field3": "boolean (optional)"
  }
}
```

**JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["field1", "field2"],
  "properties": {
    "field1": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100
    },
    "field2": {
      "type": "integer",
      "minimum": 0
    },
    "field3": {
      "type": "boolean",
      "default": false
    }
  },
  "additionalProperties": false
}
```

#### Response Contract (Success)

```json
{
  "status": 201,
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "id": "uuid",
    "field1": "string",
    "field2": "integer",
    "field3": "boolean",
    "created_at": "datetime (ISO 8601)"
  }
}
```

**JSON Schema**:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "field1", "field2", "created_at"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "field1": {
      "type": "string"
    },
    "field2": {
      "type": "integer"
    },
    "field3": {
      "type": "boolean"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

#### Response Contract (Error)

```json
{
  "status": 400,
  "body": {
    "error": "string",
    "message": "string",
    "details": ["array of strings (optional)"]
  }
}
```

---

## Implementation

### Python (FastAPI + Pydantic)

**File**: `tests/contract/test_{기능명}_contract.py`

```python
import pytest
from fastapi.testclient import TestClient
from jsonschema import validate, ValidationError
from app.main import app

client = TestClient(app)

# JSON Schema definitions
REQUEST_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["field1", "field2"],
    "properties": {
        "field1": {"type": "string", "minLength": 1, "maxLength": 100},
        "field2": {"type": "integer", "minimum": 0},
        "field3": {"type": "boolean", "default": False}
    },
    "additionalProperties": False
}

RESPONSE_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["id", "field1", "field2", "created_at"],
    "properties": {
        "id": {"type": "string", "format": "uuid"},
        "field1": {"type": "string"},
        "field2": {"type": "integer"},
        "field3": {"type": "boolean"},
        "created_at": {"type": "string", "format": "date-time"}
    }
}

class TestCreateResourceContract:
    """Contract tests for POST /api/v1/resource"""

    def test_request_schema_valid(self):
        """Request body matches contract schema"""
        payload = {
            "field1": "test value",
            "field2": 42,
            "field3": True
        }
        # Should not raise ValidationError
        validate(instance=payload, schema=REQUEST_SCHEMA)

    def test_request_schema_invalid_missing_required(self):
        """Request with missing required field is rejected"""
        payload = {
            "field1": "test value"
            # Missing field2
        }
        with pytest.raises(ValidationError):
            validate(instance=payload, schema=REQUEST_SCHEMA)

    def test_response_schema_success(self):
        """Response body matches contract schema (201 Created)"""
        payload = {
            "field1": "test value",
            "field2": 42,
            "field3": True
        }
        response = client.post(
            "/api/v1/resource",
            json=payload,
            headers={"Authorization": "Bearer test-token"}
        )

        # Status code contract
        assert response.status_code == 201

        # Response schema contract
        response_data = response.json()
        validate(instance=response_data, schema=RESPONSE_SCHEMA)

        # Data contract
        assert response_data["field1"] == payload["field1"]
        assert response_data["field2"] == payload["field2"]
        assert response_data["field3"] == payload["field3"]

    def test_response_schema_error(self):
        """Error response matches contract schema (400 Bad Request)"""
        payload = {
            "field1": "",  # Invalid: empty string
            "field2": -1   # Invalid: negative
        }
        response = client.post(
            "/api/v1/resource",
            json=payload,
            headers={"Authorization": "Bearer test-token"}
        )

        # Status code contract
        assert response.status_code == 400

        # Error schema contract
        error_data = response.json()
        assert "error" in error_data
        assert "message" in error_data
        assert isinstance(error_data["message"], str)

    def test_headers_contract(self):
        """Response headers match contract"""
        payload = {
            "field1": "test value",
            "field2": 42
        }
        response = client.post(
            "/api/v1/resource",
            json=payload,
            headers={"Authorization": "Bearer test-token"}
        )

        assert response.headers["Content-Type"] == "application/json"

    @pytest.mark.parametrize("invalid_payload,expected_error", [
        ({"field1": "x" * 101, "field2": 42}, "field1 too long"),
        ({"field1": "test", "field2": -1}, "field2 must be positive"),
        ({"field2": 42}, "field1 is required"),
    ])
    def test_validation_errors(self, invalid_payload, expected_error):
        """Contract validation errors are properly handled"""
        response = client.post(
            "/api/v1/resource",
            json=invalid_payload,
            headers={"Authorization": "Bearer test-token"}
        )
        assert response.status_code == 400
```

**Run**:
```bash
pytest tests/contract/test_{기능명}_contract.py -v --tb=short
```

---

### Python (Pact - Consumer-Driven Contracts)

**File**: `tests/pact/consumer_test_{기능명}.py`

```python
import pytest
from pact import Consumer, Provider, Like, EachLike, Format

pact = Consumer('FrontendApp').has_pact_with(Provider('BackendAPI'))

@pytest.fixture(scope='module')
def setup_pact():
    pact.start_service()
    yield
    pact.stop_service()

def test_create_resource_contract(setup_pact):
    """Consumer expects provider to create resource"""
    expected = {
        'id': Format().uuid,
        'field1': Like('test value'),
        'field2': Like(42),
        'field3': Like(True),
        'created_at': Format().iso_8601_datetime
    }

    (pact
     .given('user is authenticated')
     .upon_receiving('a request to create resource')
     .with_request('POST', '/api/v1/resource',
                   headers={'Authorization': Like('Bearer token')},
                   body={
                       'field1': 'test value',
                       'field2': 42,
                       'field3': True
                   })
     .will_respond_with(201, body=expected))

    with pact:
        # Test consumer code
        result = api_client.create_resource(field1='test value', field2=42)
        assert result['id'] is not None
        assert result['field1'] == 'test value'
```

**Generate Pact file**:
```bash
pytest tests/pact/ --pact-broker-url=https://your-pact-broker.com
```

---

### TypeScript (NestJS + Jest)

**File**: `test/contract/{기능명}.contract.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

describe('Create Resource Contract (e2e)', () => {
  let app: INestApplication;
  const ajv = new Ajv();
  addFormats(ajv);

  const requestSchema = {
    type: 'object',
    required: ['field1', 'field2'],
    properties: {
      field1: { type: 'string', minLength: 1, maxLength: 100 },
      field2: { type: 'integer', minimum: 0 },
      field3: { type: 'boolean' }
    },
    additionalProperties: false
  };

  const responseSchema = {
    type: 'object',
    required: ['id', 'field1', 'field2', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      field1: { type: 'string' },
      field2: { type: 'integer' },
      field3: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' }
    }
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/resource - validates request schema', () => {
    const payload = {
      field1: 'test value',
      field2: 42,
      field3: true
    };

    const validate = ajv.compile(requestSchema);
    expect(validate(payload)).toBe(true);
  });

  it('POST /api/v1/resource - validates response schema (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/resource')
      .set('Authorization', 'Bearer test-token')
      .send({
        field1: 'test value',
        field2: 42,
        field3: true
      })
      .expect(201)
      .expect('Content-Type', /json/);

    const validate = ajv.compile(responseSchema);
    expect(validate(response.body)).toBe(true);
  });

  it('POST /api/v1/resource - returns 400 for invalid request', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/resource')
      .set('Authorization', 'Bearer test-token')
      .send({
        field1: '',  // Invalid
        field2: -1   // Invalid
      })
      .expect(400);
  });
});
```

**Run**:
```bash
npm test -- test/contract/{기능명}.contract.spec.ts
```

---

## Contract Testing Strategy

### 1. Provider Tests (Backend)
```bash
# Run all contract tests
pytest tests/contract/ -v

# Run specific contract
pytest tests/contract/test_{기능명}_contract.py

# Generate Pact file for consumer
pytest tests/pact/ --pact-broker-url=...
```

### 2. Consumer Tests (Frontend)
```bash
# Verify against provider contract
npm run test:contract -- --pact-broker-url=...
```

### 3. CI/CD Integration
```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on: [pull_request]

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run provider contract tests
        run: pytest tests/contract/ -v
      - name: Publish Pact
        run: pytest tests/pact/ --pact-broker-url=${{ secrets.PACT_BROKER_URL }}
```

---

## Coverage Mapping

| Contract | SPEC REQ | Endpoints | Status |
|----------|----------|-----------|--------|
| Create Resource | REQ-001 | POST /api/v1/resource | ⬜ |
| Get Resource | REQ-002 | GET /api/v1/resource/:id | ⬜ |
| Update Resource | REQ-003 | PATCH /api/v1/resource/:id | ⬜ |

**Coverage**: 0 / {총 계약 수} (0%)

---

## Best Practices

1. **Test Contract, Not Implementation**
   - ✅ 스키마 준수 확인
   - ❌ 비즈니스 로직 테스트 금지

2. **Provider-First vs Consumer-First**
   - Provider-First: API 먼저 정의 → Contract 테스트 작성
   - Consumer-First: Frontend 요구사항 → Pact 작성 → Provider 구현

3. **Version Control**
   - API 버전별 Contract 파일 관리
   - Breaking Changes 감지

4. **Pact Broker 활용**
   - Contract 중앙 관리
   - Consumer-Provider 매칭
   - CI/CD 자동화

---

## Next Steps

```bash
# 1. Contract 테스트 작성
vibe contract "{기능명}"

# 2. Provider 구현
vibe run "Task 1-1"

# 3. Contract 검증
vibe test "{기능명}" --contract

# 4. Pact 발행 (선택)
pytest tests/pact/ --pact-broker-url=...
```
