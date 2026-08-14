# Swift + iOS Quality Rules

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

## Swift/iOS Specific Rules

### 1. SwiftUI Basic Structure

```swift
// Good: View structure
import SwiftUI

struct UserProfileView: View {
    // 1. State and bindings
    @StateObject private var viewModel: UserProfileViewModel
    @State private var isEditing = false
    @Binding var selectedUser: User?

    // 2. Environment variables
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authManager: AuthManager

    // 3. Body
    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Profile")
                .toolbar { toolbarContent }
                .sheet(isPresented: $isEditing) { editSheet }
        }
        .task { await viewModel.loadUser() }
    }

    // 4. Separate view components
    @ViewBuilder
    private var content: some View {
        if viewModel.isLoading {
            ProgressView()
        } else if let user = viewModel.user {
            userContent(user)
        } else {
            emptyState
        }
    }

    private func userContent(_ user: User) -> some View {
        List {
            Section("Basic Info") {
                LabeledContent("Name", value: user.name)
                LabeledContent("Email", value: user.email)
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Edit") { isEditing = true }
        }
    }
}
```

### 2. ViewModel (MVVM)

```swift
// Good: ViewModel with @Observable (iOS 17+)
import Foundation
import Observation

@Observable
final class UserProfileViewModel {
    // State
    private(set) var user: User?
    private(set) var isLoading = false
    private(set) var error: AppError?

    // Dependencies
    private let userRepository: UserRepository
    private let userId: String

    init(userId: String, userRepository: UserRepository = DefaultUserRepository()) {
        self.userId = userId
        self.userRepository = userRepository
    }

    @MainActor
    func loadUser() async {
        isLoading = true
        error = nil

        do {
            user = try await userRepository.fetchUser(id: userId)
        } catch {
            self.error = AppError.from(error)
        }

        isLoading = false
    }

    @MainActor
    func updateUser(name: String) async throws {
        guard var currentUser = user else { return }
        currentUser.name = name

        user = try await userRepository.updateUser(currentUser)
    }
}

// Good: ViewModel with ObservableObject (iOS 13+)
import Combine

final class UserListViewModel: ObservableObject {
    @Published private(set) var users: [User] = []
    @Published private(set) var isLoading = false
    @Published var searchText = ""

    private let userRepository: UserRepository
    private var cancellables = Set<AnyCancellable>()

    var filteredUsers: [User] {
        guard !searchText.isEmpty else { return users }
        return users.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    init(userRepository: UserRepository = DefaultUserRepository()) {
        self.userRepository = userRepository
        setupBindings()
    }

    private func setupBindings() {
        $searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] _ in
                self?.objectWillChange.send()
            }
            .store(in: &cancellables)
    }

    @MainActor
    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }

        do {
            users = try await userRepository.fetchUsers()
        } catch {
            print("Error: \(error)")
        }
    }
}
```

### 3. Repository Pattern

```swift
// Good: Protocol definition
protocol UserRepository {
    func fetchUsers() async throws -> [User]
    func fetchUser(id: String) async throws -> User
    func createUser(_ user: User) async throws -> User
    func updateUser(_ user: User) async throws -> User
    func deleteUser(id: String) async throws
}

// Good: Implementation
final class DefaultUserRepository: UserRepository {
    private let apiClient: APIClient
    private let cache: CacheManager

    init(apiClient: APIClient = .shared, cache: CacheManager = .shared) {
        self.apiClient = apiClient
        self.cache = cache
    }

    func fetchUser(id: String) async throws -> User {
        // Check cache
        if let cached: User = cache.get(key: "user_\(id)") {
            return cached
        }

        // API call
        let user: User = try await apiClient.request(
            endpoint: .user(id: id),
            method: .get
        )

        // Save to cache
        cache.set(key: "user_\(id)", value: user, ttl: 300)

        return user
    }

    func fetchUsers() async throws -> [User] {
        try await apiClient.request(
            endpoint: .users,
            method: .get
        )
    }
}
```

### 4. Error Handling

```swift
// Good: Custom error definition
enum AppError: LocalizedError {
    case networkError(underlying: Error)
    case decodingError(underlying: Error)
    case notFound(resource: String, id: String)
    case unauthorized
    case serverError(message: String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Please check your network connection"
        case .decodingError:
            return "Unable to process data"
        case .notFound(let resource, let id):
            return "\(resource) not found (ID: \(id))"
        case .unauthorized:
            return "Login required"
        case .serverError(let message):
            return "Server error: \(message)"
        case .unknown:
            return "An unknown error occurred"
        }
    }

    static func from(_ error: Error) -> AppError {
        if let appError = error as? AppError {
            return appError
        }

        if let urlError = error as? URLError {
            return .networkError(underlying: urlError)
        }

        if error is DecodingError {
            return .decodingError(underlying: error)
        }

        return .unknown
    }
}

// Good: Result type usage
func loadData() async -> Result<User, AppError> {
    do {
        let user = try await repository.fetchUser(id: userId)
        return .success(user)
    } catch {
        return .failure(AppError.from(error))
    }
}
```

### 5. Networking (async/await)

```swift
// Good: API Client
final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let baseURL: URL

    init(session: URLSession = .shared, baseURL: URL = Config.apiBaseURL) {
        self.session = session
        self.baseURL = baseURL
        self.decoder = JSONDecoder()
        self.decoder.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder.dateDecodingStrategy = .iso8601
    }

    func request<T: Decodable>(
        endpoint: Endpoint,
        method: HTTPMethod,
        body: Encodable? = nil
    ) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // Auth token
        if let token = AuthManager.shared.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        // Body
        if let body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.unknown
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try decoder.decode(T.self, from: data)
        case 401:
            throw AppError.unauthorized
        case 404:
            throw AppError.notFound(resource: endpoint.resource, id: endpoint.id ?? "")
        default:
            throw AppError.serverError(message: "Status: \(httpResponse.statusCode)")
        }
    }
}

// Good: Endpoint definition
enum Endpoint {
    case users
    case user(id: String)
    case createUser
    case updateUser(id: String)

    var path: String {
        switch self {
        case .users, .createUser:
            return "/users"
        case .user(let id), .updateUser(let id):
            return "/users/\(id)"
        }
    }

    var resource: String { "User" }

    var id: String? {
        switch self {
        case .user(let id), .updateUser(let id):
            return id
        default:
            return nil
        }
    }
}
```

### 6. Dependency Injection

```swift
// Good: DI via Environment (SwiftUI)
private struct UserRepositoryKey: EnvironmentKey {
    static let defaultValue: UserRepository = DefaultUserRepository()
}

extension EnvironmentValues {
    var userRepository: UserRepository {
        get { self[UserRepositoryKey.self] }
        set { self[UserRepositoryKey.self] = newValue }
    }
}

// Usage
struct ContentView: View {
    @Environment(\.userRepository) private var userRepository

    var body: some View {
        UserListView(viewModel: UserListViewModel(userRepository: userRepository))
    }
}

// Good: Container pattern
final class DIContainer {
    static let shared = DIContainer()

    lazy var userRepository: UserRepository = DefaultUserRepository(
        apiClient: apiClient,
        cache: cacheManager
    )

    lazy var apiClient: APIClient = APIClient()
    lazy var cacheManager: CacheManager = CacheManager()

    private init() {}
}
```

### 7. Testing

```swift
import XCTest
@testable import MyApp

// Good: Mock Repository
final class MockUserRepository: UserRepository {
    var fetchUsersResult: Result<[User], Error> = .success([])
    var fetchUserResult: Result<User, Error> = .failure(AppError.notFound(resource: "User", id: ""))

    func fetchUsers() async throws -> [User] {
        try fetchUsersResult.get()
    }

    func fetchUser(id: String) async throws -> User {
        try fetchUserResult.get()
    }

    // ... other methods
}

// Good: ViewModel test
final class UserListViewModelTests: XCTestCase {
    var sut: UserListViewModel!
    var mockRepository: MockUserRepository!

    override func setUp() {
        super.setUp()
        mockRepository = MockUserRepository()
        sut = UserListViewModel(userRepository: mockRepository)
    }

    override func tearDown() {
        sut = nil
        mockRepository = nil
        super.tearDown()
    }

    func test_loadUsers_onSuccess_updatesUsers() async {
        // Given
        let expectedUsers = [
            User(id: "1", name: "Test1", email: "test1@example.com"),
            User(id: "2", name: "Test2", email: "test2@example.com")
        ]
        mockRepository.fetchUsersResult = .success(expectedUsers)

        // When
        await sut.loadUsers()

        // Then
        XCTAssertEqual(sut.users.count, 2)
        XCTAssertFalse(sut.isLoading)
    }

    func test_filteredUsers_withSearchText_filtersCorrectly() {
        // Given
        sut.users = [
            User(id: "1", name: "John Doe", email: "john@example.com"),
            User(id: "2", name: "Jane Smith", email: "jane@example.com")
        ]

        // When
        sut.searchText = "John"

        // Then
        XCTAssertEqual(sut.filteredUsers.count, 1)
        XCTAssertEqual(sut.filteredUsers.first?.name, "John Doe")
    }
}
```

## File Structure

```text
Project/
├── App/
│   ├── ProjectApp.swift         # App entry point
│   └── DIContainer.swift        # Dependency container
├── Features/
│   ├── Auth/
│   │   ├── Views/
│   │   ├── ViewModels/
│   │   └── Models/
│   └── User/
│       ├── Views/
│       │   ├── UserListView.swift
│       │   └── UserDetailView.swift
│       ├── ViewModels/
│       │   └── UserListViewModel.swift
│       └── Models/
│           └── User.swift
├── Core/
│   ├── Network/
│   │   ├── APIClient.swift
│   │   └── Endpoint.swift
│   ├── Storage/
│   │   └── CacheManager.swift
│   └── Utils/
│       └── Extensions/
├── Repositories/
│   ├── UserRepository.swift
│   └── Implementations/
├── Resources/
│   ├── Assets.xcassets
│   └── Localizable.strings
└── Tests/
    ├── UnitTests/
    └── UITests/
```

## Checklist

- [ ] Use @Observable or @ObservableObject
- [ ] Follow MVVM pattern
- [ ] Handle async with async/await
- [ ] Abstract dependencies with Protocol
- [ ] Ensure UI updates with @MainActor
- [ ] Define error messages with LocalizedError
- [ ] Separate conditional views with @ViewBuilder
- [ ] Testable structure (Mock injection)
