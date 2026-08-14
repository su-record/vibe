# Kotlin + Android Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Kotlin/Android Specific Rules

### 1. Jetpack Compose UI

```kotlin
// Good: Composable function
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

// Good: Stateless Composable (reusable)
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
                title = { Text("Profile") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
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

// Good: Reusable component
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
                contentDescription = "${user.name} profile",
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
// Good: UiState definition (Sealed Interface)
sealed interface UserListUiState {
    data object Loading : UserListUiState
    data class Success(
        val users: List<User>,
        val isRefreshing: Boolean = false
    ) : UserListUiState
    data class Error(val message: String) : UserListUiState
}

// Good: ViewModel with Hilt
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
                        error.message ?: "Failed to load user list"
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
                .onFailure { /* Error handling */ }
        }
    }
}
```

### 3. UseCase (Clean Architecture)

```kotlin
// Good: UseCase definition
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
        // Validation
        validator.validate(request).onFailure { return Result.failure(it) }

        return runCatching {
            userRepository.createUser(request)
        }
    }
}
```

### 4. Repository Pattern

```kotlin
// Good: Repository Interface
interface UserRepository {
    suspend fun getUsers(): List<User>
    suspend fun getUser(id: String): User
    suspend fun createUser(request: CreateUserRequest): User
    suspend fun updateUser(id: String, request: UpdateUserRequest): User
    suspend fun deleteUser(id: String)
}

// Good: Repository implementation
class UserRepositoryImpl @Inject constructor(
    private val apiService: UserApiService,
    private val userDao: UserDao,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) : UserRepository {

    override suspend fun getUsers(): List<User> = withContext(dispatcher) {
        try {
            // Fetch data from API
            val response = apiService.getUsers()
            val users = response.map { it.toDomain() }

            // Update local cache
            userDao.insertAll(users.map { it.toEntity() })

            users
        } catch (e: Exception) {
            // Offline: Return local data
            userDao.getAll().map { it.toDomain() }
        }
    }

    override suspend fun getUser(id: String): User = withContext(dispatcher) {
        val response = apiService.getUser(id)
        response.toDomain()
    }
}
```

### 5. Error Handling

```kotlin
// Good: Custom exception
sealed class AppException(message: String) : Exception(message) {
    class NetworkException(message: String = "Please check your network connection") : AppException(message)
    class UnauthorizedException(message: String = "Login required") : AppException(message)
    class NotFoundException(
        val resource: String,
        val id: String
    ) : AppException("$resource not found (ID: $id)")
    class ServerException(message: String) : AppException(message)
    class ValidationException(message: String) : AppException(message)
}

// Good: Result extension functions
inline fun <T> Result<T>.onSuccess(action: (T) -> Unit): Result<T> {
    getOrNull()?.let(action)
    return this
}

inline fun <T> Result<T>.onFailure(action: (Throwable) -> Unit): Result<T> {
    exceptionOrNull()?.let(action)
    return this
}

// Good: API response handling
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
                    404 -> throw AppException.NotFoundException("Resource", "unknown")
                    else -> throw AppException.ServerException("Server error: ${throwable.code()}")
                }
            }
            is IOException -> throw AppException.NetworkException()
            else -> throw throwable
        }
    }
}
```

### 6. Hilt Dependency Injection

```kotlin
// Good: Module definition
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

### 7. Testing

```kotlin
// Good: ViewModel test
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
    fun `loadUsers success results in Success state`() = runTest {
        // Given
        val expectedUsers = listOf(
            User(id = "1", name = "Test1", email = "test1@example.com"),
            User(id = "2", name = "Test2", email = "test2@example.com")
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
    fun `loadUsers failure results in Error state`() = runTest {
        // Given
        fakeUserRepository.setShouldReturnError(true)

        // When
        viewModel.loadUsers()

        // Then
        val state = viewModel.uiState.value
        assertThat(state).isInstanceOf(UserListUiState.Error::class.java)
    }
}

// Good: Fake Repository
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

    // ... other methods
}
```

## File Structure

```
app/
├── src/main/java/com/example/app/
│   ├── di/                      # Hilt modules
│   │   ├── NetworkModule.kt
│   │   └── RepositoryModule.kt
│   ├── data/
│   │   ├── api/                 # API services
│   │   │   └── UserApiService.kt
│   │   ├── local/               # Room DAO
│   │   │   └── UserDao.kt
│   │   ├── model/               # DTO
│   │   │   └── UserDto.kt
│   │   └── repository/          # Repository implementation
│   │       └── UserRepositoryImpl.kt
│   ├── domain/
│   │   ├── model/               # Domain models
│   │   │   └── User.kt
│   │   ├── repository/          # Repository interfaces
│   │   │   └── UserRepository.kt
│   │   └── usecase/             # UseCase
│   │       └── GetUsersUseCase.kt
│   └── presentation/
│       ├── ui/
│       │   ├── components/      # Common Composables
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

## Checklist

- [ ] Use Jetpack Compose (avoid XML layouts)
- [ ] Manage UI state with StateFlow
- [ ] Define UiState with Sealed Interface
- [ ] Use Hilt for dependency injection
- [ ] Separate business logic with UseCase
- [ ] Abstract data layer with Repository pattern
- [ ] Handle errors with Result/runCatching
- [ ] Use collectAsStateWithLifecycle()
