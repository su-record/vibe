# ☕ Java + Spring Boot 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 메서드 ≤ 30줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Spring Boot 특화 규칙

### 1. Controller 레이어

```java
// ✅ REST Controller
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User", description = "사용자 관리 API")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "사용자 목록 조회")
    public ResponseEntity<Page<UserResponse>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<UserResponse> users = userService.getUsers(pageable);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "사용자 상세 조회")
    public ResponseEntity<UserResponse> getUser(
            @PathVariable Long id
    ) {
        UserResponse user = userService.getUser(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping
    @Operation(summary = "사용자 생성")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request
    ) {
        UserResponse user = userService.createUser(request);
        URI location = URI.create("/api/v1/users/" + user.getId());
        return ResponseEntity.created(location).body(user);
    }

    @PutMapping("/{id}")
    @Operation(summary = "사용자 수정")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        UserResponse user = userService.updateUser(id, request);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "사용자 삭제")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
```

### 2. Service 레이어

```java
// ✅ Service Interface
public interface UserService {
    Page<UserResponse> getUsers(Pageable pageable);
    UserResponse getUser(Long id);
    UserResponse createUser(CreateUserRequest request);
    UserResponse updateUser(Long id, UpdateUserRequest request);
    void deleteUser(Long id);
}

// ✅ Service 구현
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    @Override
    public Page<UserResponse> getUsers(Pageable pageable) {
        return userRepository.findAll(pageable)
                .map(userMapper::toResponse);
    }

    @Override
    public UserResponse getUser(Long id) {
        User user = findUserById(id);
        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        validateEmailNotExists(request.getEmail());

        User user = User.builder()
                .email(request.getEmail())
                .name(request.getName())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        User savedUser = userRepository.save(user);
        return userMapper.toResponse(savedUser);
    }

    @Override
    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request) {
        User user = findUserById(id);
        user.update(request.getName(), request.getPhone());
        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public void deleteUser(Long id) {
        User user = findUserById(id);
        userRepository.delete(user);
    }

    private User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("사용자", id));
    }

    private void validateEmailNotExists(String email) {
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("이미 존재하는 이메일입니다: " + email);
        }
    }
}
```

### 3. Entity 설계

```java
// ✅ 기본 Entity (Auditing)
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseEntity {

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}

// ✅ User Entity
@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String password;

    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserStatus status = UserStatus.ACTIVE;

    @OneToMany(mappedBy = "author", cascade = CascadeType.ALL)
    private List<Post> posts = new ArrayList<>();

    @Builder
    public User(String email, String name, String password) {
        this.email = email;
        this.name = name;
        this.password = password;
    }

    // 비즈니스 메서드
    public void update(String name, String phone) {
        this.name = name;
        this.phone = phone;
    }

    public void changePassword(String newPassword) {
        this.password = newPassword;
    }

    public void deactivate() {
        this.status = UserStatus.INACTIVE;
    }
}

// ✅ Enum
public enum UserStatus {
    ACTIVE, INACTIVE, SUSPENDED
}
```

### 4. Repository 레이어

```java
// ✅ JPA Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.status = :status")
    Page<User> findByStatus(@Param("status") UserStatus status, Pageable pageable);

    // QueryDSL Custom Repository
    Page<User> searchUsers(UserSearchCondition condition, Pageable pageable);
}

// ✅ Custom Repository 구현 (QueryDSL)
@RequiredArgsConstructor
public class UserRepositoryCustomImpl implements UserRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<User> searchUsers(UserSearchCondition condition, Pageable pageable) {
        List<User> content = queryFactory
                .selectFrom(user)
                .where(
                        nameContains(condition.getName()),
                        emailContains(condition.getEmail()),
                        statusEq(condition.getStatus())
                )
                .offset(pageable.getOffset())
                .limit(pageable.getPageSize())
                .orderBy(user.createdAt.desc())
                .fetch();

        Long total = queryFactory
                .select(user.count())
                .from(user)
                .where(
                        nameContains(condition.getName()),
                        emailContains(condition.getEmail()),
                        statusEq(condition.getStatus())
                )
                .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0);
    }

    private BooleanExpression nameContains(String name) {
        return StringUtils.hasText(name) ? user.name.contains(name) : null;
    }

    private BooleanExpression emailContains(String email) {
        return StringUtils.hasText(email) ? user.email.contains(email) : null;
    }

    private BooleanExpression statusEq(UserStatus status) {
        return status != null ? user.status.eq(status) : null;
    }
}
```

### 5. DTO와 Validation

```java
// ✅ Request DTO
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Schema(description = "사용자 생성 요청")
public class CreateUserRequest {

    @NotBlank(message = "이메일은 필수입니다")
    @Email(message = "올바른 이메일 형식이 아닙니다")
    @Schema(description = "이메일", example = "user@example.com")
    private String email;

    @NotBlank(message = "이름은 필수입니다")
    @Size(min = 2, max = 50, message = "이름은 2~50자 사이여야 합니다")
    @Schema(description = "이름", example = "홍길동")
    private String name;

    @NotBlank(message = "비밀번호는 필수입니다")
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{8,}$",
        message = "비밀번호는 8자 이상, 영문/숫자/특수문자를 포함해야 합니다"
    )
    @Schema(description = "비밀번호", example = "Password123!")
    private String password;
}

// ✅ Response DTO
@Getter
@Builder
@Schema(description = "사용자 응답")
public class UserResponse {

    @Schema(description = "사용자 ID", example = "1")
    private Long id;

    @Schema(description = "이메일", example = "user@example.com")
    private String email;

    @Schema(description = "이름", example = "홍길동")
    private String name;

    @Schema(description = "상태", example = "ACTIVE")
    private UserStatus status;

    @Schema(description = "생성일시")
    private LocalDateTime createdAt;
}

// ✅ Mapper (MapStruct)
@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);
}
```

### 6. 예외 처리

```java
// ✅ 커스텀 예외
@Getter
public class BusinessException extends RuntimeException {
    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public BusinessException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}

public class ResourceNotFoundException extends BusinessException {
    public ResourceNotFoundException(String resource, Long id) {
        super(ErrorCode.NOT_FOUND, String.format("%s을(를) 찾을 수 없습니다 (ID: %d)", resource, id));
    }
}

public class DuplicateResourceException extends BusinessException {
    public DuplicateResourceException(String message) {
        super(ErrorCode.DUPLICATE, message);
    }
}

// ✅ Error Code
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Common
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "잘못된 입력입니다"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "C002", "리소스를 찾을 수 없습니다"),
    DUPLICATE(HttpStatus.CONFLICT, "C003", "이미 존재하는 리소스입니다"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C004", "서버 오류가 발생했습니다"),

    // Auth
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "A001", "인증이 필요합니다"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "A002", "접근 권한이 없습니다");

    private final HttpStatus status;
    private final String code;
    private final String message;
}

// ✅ Global Exception Handler
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException e) {
        log.warn("Business exception: {}", e.getMessage());
        ErrorCode errorCode = e.getErrorCode();
        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ErrorResponse.of(errorCode, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException e) {
        log.warn("Validation exception: {}", e.getMessage());
        List<FieldError> fieldErrors = e.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
                .toList();
        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of(ErrorCode.INVALID_INPUT, fieldErrors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unexpected exception", e);
        return ResponseEntity
                .internalServerError()
                .body(ErrorResponse.of(ErrorCode.INTERNAL_ERROR));
    }
}
```

### 7. 테스트

```java
// ✅ Service 단위 테스트
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private UserServiceImpl userService;

    @Test
    @DisplayName("사용자 조회 성공")
    void getUser_Success() {
        // given
        Long userId = 1L;
        User user = createTestUser(userId);
        UserResponse expectedResponse = createTestUserResponse(userId);

        given(userRepository.findById(userId)).willReturn(Optional.of(user));
        given(userMapper.toResponse(user)).willReturn(expectedResponse);

        // when
        UserResponse response = userService.getUser(userId);

        // then
        assertThat(response.getId()).isEqualTo(userId);
        assertThat(response.getEmail()).isEqualTo("test@example.com");
        then(userRepository).should().findById(userId);
    }

    @Test
    @DisplayName("존재하지 않는 사용자 조회시 예외 발생")
    void getUser_NotFound_ThrowsException() {
        // given
        Long userId = 999L;
        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> userService.getUser(userId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("사용자");
    }

    private User createTestUser(Long id) {
        return User.builder()
                .email("test@example.com")
                .name("테스트")
                .password("encoded")
                .build();
    }
}

// ✅ Controller 통합 테스트
@WebMvcTest(UserController.class)
@Import(SecurityConfig.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("POST /api/v1/users - 사용자 생성 성공")
    void createUser_Success() throws Exception {
        // given
        CreateUserRequest request = new CreateUserRequest(
                "test@example.com", "테스트", "Password123!"
        );
        UserResponse response = UserResponse.builder()
                .id(1L)
                .email("test@example.com")
                .name("테스트")
                .status(UserStatus.ACTIVE)
                .build();

        given(userService.createUser(any())).willReturn(response);

        // when & then
        mockMvc.perform(post("/api/v1/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }
}
```

## 파일 구조

```
src/main/java/com/example/app/
├── config/                      # 설정
│   ├── SecurityConfig.java
│   ├── JpaConfig.java
│   └── SwaggerConfig.java
├── domain/
│   └── user/
│       ├── controller/
│       │   └── UserController.java
│       ├── service/
│       │   ├── UserService.java
│       │   └── UserServiceImpl.java
│       ├── repository/
│       │   ├── UserRepository.java
│       │   └── UserRepositoryCustomImpl.java
│       ├── entity/
│       │   └── User.java
│       └── dto/
│           ├── CreateUserRequest.java
│           ├── UpdateUserRequest.java
│           └── UserResponse.java
├── global/
│   ├── common/
│   │   ├── BaseEntity.java
│   │   └── BaseResponse.java
│   ├── error/
│   │   ├── ErrorCode.java
│   │   ├── ErrorResponse.java
│   │   ├── BusinessException.java
│   │   └── GlobalExceptionHandler.java
│   └── util/
└── Application.java
```

## 체크리스트

- [ ] Controller → Service → Repository 레이어 분리
- [ ] @Valid로 요청 검증
- [ ] @Transactional 적절히 사용 (readOnly 포함)
- [ ] 커스텀 예외 + GlobalExceptionHandler
- [ ] DTO ↔ Entity 변환 (MapStruct 권장)
- [ ] JPA N+1 문제 방지 (fetch join, @EntityGraph)
- [ ] 단위 테스트 + 통합 테스트
- [ ] Swagger/OpenAPI 문서화
