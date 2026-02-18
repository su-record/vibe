# Java + Spring Boot Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Method <= 30 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Spring Boot Specific Rules

### 1. Controller Layer

```java
// Good: REST Controller
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User", description = "User Management API")
public class UserController {

    private final UserService userService;

    @GetMapping
    @Operation(summary = "Get user list")
    public ResponseEntity<Page<UserResponse>> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<UserResponse> users = userService.getUsers(pageable);
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user detail")
    public ResponseEntity<UserResponse> getUser(
            @PathVariable Long id
    ) {
        UserResponse user = userService.getUser(id);
        return ResponseEntity.ok(user);
    }

    @PostMapping
    @Operation(summary = "Create user")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody CreateUserRequest request
    ) {
        UserResponse user = userService.createUser(request);
        URI location = URI.create("/api/v1/users/" + user.getId());
        return ResponseEntity.created(location).body(user);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update user")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request
    ) {
        UserResponse user = userService.updateUser(id, request);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete user")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
```

### 2. Service Layer

```java
// Good: Service Interface
public interface UserService {
    Page<UserResponse> getUsers(Pageable pageable);
    UserResponse getUser(Long id);
    UserResponse createUser(CreateUserRequest request);
    UserResponse updateUser(Long id, UpdateUserRequest request);
    void deleteUser(Long id);
}

// Good: Service implementation
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
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private void validateEmailNotExists(String email) {
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("Email already exists: " + email);
        }
    }
}
```

### 3. Entity Design

```java
// Good: Base Entity (Auditing)
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

// Good: User Entity
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

    // Business methods
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

// Good: Enum
public enum UserStatus {
    ACTIVE, INACTIVE, SUSPENDED
}
```

### 4. Repository Layer

```java
// Good: JPA Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.status = :status")
    Page<User> findByStatus(@Param("status") UserStatus status, Pageable pageable);

    // QueryDSL Custom Repository
    Page<User> searchUsers(UserSearchCondition condition, Pageable pageable);
}

// Good: Custom Repository implementation (QueryDSL)
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

### 5. DTO and Validation

```java
// Good: Request DTO
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Schema(description = "Create user request")
public class CreateUserRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Schema(description = "Email", example = "user@example.com")
    private String email;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 50, message = "Name must be between 2-50 characters")
    @Schema(description = "Name", example = "John Doe")
    private String name;

    @NotBlank(message = "Password is required")
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[@$!%*#?&])[A-Za-z\\d@$!%*#?&]{8,}$",
        message = "Password must be at least 8 characters with letters/numbers/special characters"
    )
    @Schema(description = "Password", example = "Password123!")
    private String password;
}

// Good: Response DTO
@Getter
@Builder
@Schema(description = "User response")
public class UserResponse {

    @Schema(description = "User ID", example = "1")
    private Long id;

    @Schema(description = "Email", example = "user@example.com")
    private String email;

    @Schema(description = "Name", example = "John Doe")
    private String name;

    @Schema(description = "Status", example = "ACTIVE")
    private UserStatus status;

    @Schema(description = "Created at")
    private LocalDateTime createdAt;
}

// Good: Mapper (MapStruct)
@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toResponse(User user);

    List<UserResponse> toResponseList(List<User> users);
}
```

### 6. Exception Handling

```java
// Good: Custom exception
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
        super(ErrorCode.NOT_FOUND, String.format("%s not found (ID: %d)", resource, id));
    }
}

public class DuplicateResourceException extends BusinessException {
    public DuplicateResourceException(String message) {
        super(ErrorCode.DUPLICATE, message);
    }
}

// Good: Error Code
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Common
    INVALID_INPUT(HttpStatus.BAD_REQUEST, "C001", "Invalid input"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "C002", "Resource not found"),
    DUPLICATE(HttpStatus.CONFLICT, "C003", "Resource already exists"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C004", "Server error occurred"),

    // Auth
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "A001", "Authentication required"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "A002", "Access denied");

    private final HttpStatus status;
    private final String code;
    private final String message;
}

// Good: Global Exception Handler
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

### 7. Testing

```java
// Good: Service unit test
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
    @DisplayName("Get user success")
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
    @DisplayName("Get non-existent user throws exception")
    void getUser_NotFound_ThrowsException() {
        // given
        Long userId = 999L;
        given(userRepository.findById(userId)).willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> userService.getUser(userId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User");
    }

    private User createTestUser(Long id) {
        return User.builder()
                .email("test@example.com")
                .name("Test")
                .password("encoded")
                .build();
    }
}

// Good: Controller integration test
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
    @DisplayName("POST /api/v1/users - Create user success")
    void createUser_Success() throws Exception {
        // given
        CreateUserRequest request = new CreateUserRequest(
                "test@example.com", "Test", "Password123!"
        );
        UserResponse response = UserResponse.builder()
                .id(1L)
                .email("test@example.com")
                .name("Test")
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

## File Structure

```text
src/main/java/com/example/app/
├── config/                      # Configuration
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

## Checklist

- [ ] Controller -> Service -> Repository layer separation
- [ ] Validate requests with @Valid
- [ ] Use @Transactional appropriately (including readOnly)
- [ ] Custom exception + GlobalExceptionHandler
- [ ] DTO <-> Entity conversion (MapStruct recommended)
- [ ] Prevent JPA N+1 problem (fetch join, @EntityGraph)
- [ ] Unit tests + Integration tests
- [ ] Swagger/OpenAPI documentation
