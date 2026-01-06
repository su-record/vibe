# 🤖 Kotlin + Android 품질 규칙

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

## Kotlin/Android 특화 규칙

### 1. Jetpack Compose UI

```kotlin
// ✅ Composable 함수
@Composable
fun UserProfileScreen(
    viewModel: UserProfileViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    UserProfileContent(
        uiState = uiState,
        onRefresh = viewModel::loadUser,
        onNavigateBack = onNavigateBack
    )
}

// ✅ Stateless Composable (재사용 가능)
@Composable
private fun UserProfileContent(
    uiState: UserProfileUiState,
    onRefresh: () -> Unit,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("프로필") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "뒤로")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is UserProfileUiState.Loading -> LoadingContent(modifier.padding(paddingValues))
            is UserProfileUiState.Success -> UserContent(
                user = uiState.user,
                modifier = modifier.padding(paddingValues)
            )
            is UserProfileUiState.Error -> ErrorContent(
                message = uiState.message,
                onRetry = onRefresh,
                modifier = modifier.padding(paddingValues)
            )
        }
    }
}

// ✅ 재사용 가능한 컴포넌트
@Composable
fun UserCard(
    user: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AsyncImage(
                model = user.profileImage,
                contentDescription = "${user.name} 프로필",
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = user.name,
                    style = MaterialTheme.typography.titleMedium
                )
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
```

### 2. ViewModel (MVVM)

```kotlin
// ✅ UiState 정의 (Sealed Interface)
sealed interface UserListUiState {
    data object Loading : UserListUiState
    data class Success(
        val users: List<User>,
        val isRefreshing: Boolean = false
    ) : UserListUiState
    data class Error(val message: String) : UserListUiState
}

// ✅ ViewModel with Hilt
@HiltViewModel
class UserListViewModel @Inject constructor(
    private val getUsersUseCase: GetUsersUseCase,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<UserListUiState>(UserListUiState.Loading)
    val uiState: StateFlow<UserListUiState> = _uiState.asStateFlow()

    private val searchQuery = savedStateHandle.getStateFlow("search", "")

    val filteredUsers: StateFlow<List<User>> = combine(
        _uiState,
        searchQuery
    ) { state, query ->
        when (state) {
            is UserListUiState.Success -> {
                if (query.isBlank()) state.users
                else state.users.filter { it.name.contains(query, ignoreCase = true) }
            }
            else -> emptyList()
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UserListUiState.Loading

            getUsersUseCase()
                .onSuccess { users ->
                    _uiState.value = UserListUiState.Success(users)
                }
                .onFailure { error ->
                    _uiState.value = UserListUiState.Error(
                        error.message ?: "사용자 목록을 불러올 수 없습니다"
                    )
                }
        }
    }

    fun updateSearchQuery(query: String) {
        savedStateHandle["search"] = query
    }

    fun refresh() {
        viewModelScope.launch {
            val currentState = _uiState.value
            if (currentState is UserListUiState.Success) {
                _uiState.value = currentState.copy(isRefreshing = true)
            }

            getUsersUseCase()
                .onSuccess { users ->
                    _uiState.value = UserListUiState.Success(users, isRefreshing = false)
                }
                .onFailure { /* 에러 처리 */ }
        }
    }
}
```

### 3. UseCase (Clean Architecture)

```kotlin
// ✅ UseCase 정의
class GetUsersUseCase @Inject constructor(
    private val userRepository: UserRepository,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    suspend operator fun invoke(): Result<List<User>> = withContext(dispatcher) {
        runCatching {
            userRepository.getUsers()
        }
    }
}

class GetUserUseCase @Inject constructor(
    private val userRepository: UserRepository
) {
    suspend operator fun invoke(id: String): Result<User> = runCatching {
        userRepository.getUser(id)
    }
}

class CreateUserUseCase @Inject constructor(
    private val userRepository: UserRepository,
    private val validator: UserValidator
) {
    suspend operator fun invoke(request: CreateUserRequest): Result<User> {
        // 유효성 검사
        validator.validate(request).onFailure { return Result.failure(it) }

        return runCatching {
            userRepository.createUser(request)
        }
    }
}
```

### 4. Repository 패턴

```kotlin
// ✅ Repository Interface
interface UserRepository {
    suspend fun getUsers(): List<User>
    suspend fun getUser(id: String): User
    suspend fun createUser(request: CreateUserRequest): User
    suspend fun updateUser(id: String, request: UpdateUserRequest): User
    suspend fun deleteUser(id: String)
}

// ✅ Repository 구현
class UserRepositoryImpl @Inject constructor(
    private val apiService: UserApiService,
    private val userDao: UserDao,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) : UserRepository {

    override suspend fun getUsers(): List<User> = withContext(dispatcher) {
        try {
            // API에서 데이터 가져오기
            val response = apiService.getUsers()
            val users = response.map { it.toDomain() }

            // 로컬 캐시 업데이트
            userDao.insertAll(users.map { it.toEntity() })

            users
        } catch (e: Exception) {
            // 오프라인: 로컬 데이터 반환
            userDao.getAll().map { it.toDomain() }
        }
    }

    override suspend fun getUser(id: String): User = withContext(dispatcher) {
        val response = apiService.getUser(id)
        response.toDomain()
    }
}
```

### 5. 에러 처리

```kotlin
// ✅ 커스텀 예외
sealed class AppException(message: String) : Exception(message) {
    class NetworkException(message: String = "네트워크 연결을 확인해주세요") : AppException(message)
    class UnauthorizedException(message: String = "로그인이 필요합니다") : AppException(message)
    class NotFoundException(
        val resource: String,
        val id: String
    ) : AppException("${resource}을(를) 찾을 수 없습니다 (ID: $id)")
    class ServerException(message: String) : AppException(message)
    class ValidationException(message: String) : AppException(message)
}

// ✅ Result 확장 함수
inline fun <T> Result<T>.onSuccess(action: (T) -> Unit): Result<T> {
    getOrNull()?.let(action)
    return this
}

inline fun <T> Result<T>.onFailure(action: (Throwable) -> Unit): Result<T> {
    exceptionOrNull()?.let(action)
    return this
}

// ✅ API 응답 처리
suspend fun <T> safeApiCall(
    dispatcher: CoroutineDispatcher = Dispatchers.IO,
    apiCall: suspend () -> T
): Result<T> = withContext(dispatcher) {
    runCatching {
        apiCall()
    }.recoverCatching { throwable ->
        when (throwable) {
            is HttpException -> {
                when (throwable.code()) {
                    401 -> throw AppException.UnauthorizedException()
                    404 -> throw AppException.NotFoundException("리소스", "unknown")
                    else -> throw AppException.ServerException("서버 오류: ${throwable.code()}")
                }
            }
            is IOException -> throw AppException.NetworkException()
            else -> throw throwable
        }
    }
}
```

### 6. Hilt 의존성 주입

```kotlin
// ✅ Module 정의
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor())
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            })
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideUserApiService(retrofit: Retrofit): UserApiService {
        return retrofit.create(UserApiService::class.java)
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindUserRepository(impl: UserRepositoryImpl): UserRepository
}
```

### 7. 테스트

```kotlin
// ✅ ViewModel 테스트
@OptIn(ExperimentalCoroutinesApi::class)
class UserListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private lateinit var viewModel: UserListViewModel
    private lateinit var getUsersUseCase: GetUsersUseCase
    private lateinit var fakeUserRepository: FakeUserRepository

    @Before
    fun setup() {
        fakeUserRepository = FakeUserRepository()
        getUsersUseCase = GetUsersUseCase(fakeUserRepository)
        viewModel = UserListViewModel(getUsersUseCase, SavedStateHandle())
    }

    @Test
    fun `loadUsers 성공시 Success 상태가 된다`() = runTest {
        // Given
        val expectedUsers = listOf(
            User(id = "1", name = "테스트1", email = "test1@example.com"),
            User(id = "2", name = "테스트2", email = "test2@example.com")
        )
        fakeUserRepository.setUsers(expectedUsers)

        // When
        viewModel.loadUsers()

        // Then
        val state = viewModel.uiState.value
        assertThat(state).isInstanceOf(UserListUiState.Success::class.java)
        assertThat((state as UserListUiState.Success).users).hasSize(2)
    }

    @Test
    fun `loadUsers 실패시 Error 상태가 된다`() = runTest {
        // Given
        fakeUserRepository.setShouldReturnError(true)

        // When
        viewModel.loadUsers()

        // Then
        val state = viewModel.uiState.value
        assertThat(state).isInstanceOf(UserListUiState.Error::class.java)
    }
}

// ✅ Fake Repository
class FakeUserRepository : UserRepository {
    private var users = mutableListOf<User>()
    private var shouldReturnError = false

    fun setUsers(users: List<User>) {
        this.users = users.toMutableList()
    }

    fun setShouldReturnError(value: Boolean) {
        shouldReturnError = value
    }

    override suspend fun getUsers(): List<User> {
        if (shouldReturnError) throw Exception("Test error")
        return users
    }

    // ... 다른 메서드
}
```

## 파일 구조

```
app/
├── src/main/java/com/example/app/
│   ├── di/                      # Hilt 모듈
│   │   ├── NetworkModule.kt
│   │   └── RepositoryModule.kt
│   ├── data/
│   │   ├── api/                 # API 서비스
│   │   │   └── UserApiService.kt
│   │   ├── local/               # Room DAO
│   │   │   └── UserDao.kt
│   │   ├── model/               # DTO
│   │   │   └── UserDto.kt
│   │   └── repository/          # Repository 구현
│   │       └── UserRepositoryImpl.kt
│   ├── domain/
│   │   ├── model/               # 도메인 모델
│   │   │   └── User.kt
│   │   ├── repository/          # Repository 인터페이스
│   │   │   └── UserRepository.kt
│   │   └── usecase/             # UseCase
│   │       └── GetUsersUseCase.kt
│   └── presentation/
│       ├── ui/
│       │   ├── components/      # 공통 Composable
│       │   └── theme/           # Material Theme
│       └── feature/
│           └── user/
│               ├── UserListScreen.kt
│               ├── UserListViewModel.kt
│               └── UserListUiState.kt
└── src/test/
    └── java/com/example/app/
        └── presentation/
            └── feature/user/
                └── UserListViewModelTest.kt
```

## 체크리스트

- [ ] Jetpack Compose 사용 (XML 레이아웃 지양)
- [ ] StateFlow로 UI 상태 관리
- [ ] Sealed Interface로 UiState 정의
- [ ] Hilt로 의존성 주입
- [ ] UseCase로 비즈니스 로직 분리
- [ ] Repository 패턴으로 데이터 계층 추상화
- [ ] Result/runCatching으로 에러 처리
- [ ] collectAsStateWithLifecycle() 사용
