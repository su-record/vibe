# 🍎 Swift + iOS 품질 규칙

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

## Swift/iOS 특화 규칙

### 1. SwiftUI 기본 구조

```swift
// ✅ View 구조
import SwiftUI

struct UserProfileView: View {
    // 1. 상태 및 바인딩
    @StateObject private var viewModel: UserProfileViewModel
    @State private var isEditing = false
    @Binding var selectedUser: User?

    // 2. 환경 변수
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var authManager: AuthManager

    // 3. Body
    var body: some View {
        NavigationStack {
            content
                .navigationTitle("프로필")
                .toolbar { toolbarContent }
                .sheet(isPresented: $isEditing) { editSheet }
        }
        .task { await viewModel.loadUser() }
    }

    // 4. 뷰 컴포넌트 분리
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
            Section("기본 정보") {
                LabeledContent("이름", value: user.name)
                LabeledContent("이메일", value: user.email)
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("편집") { isEditing = true }
        }
    }
}
```

### 2. ViewModel (MVVM)

```swift
// ✅ ViewModel with @Observable (iOS 17+)
import Foundation
import Observation

@Observable
final class UserProfileViewModel {
    // 상태
    private(set) var user: User?
    private(set) var isLoading = false
    private(set) var error: AppError?

    // 의존성
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

// ✅ ViewModel with ObservableObject (iOS 13+)
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

### 3. Repository 패턴

```swift
// ✅ Protocol 정의
protocol UserRepository {
    func fetchUsers() async throws -> [User]
    func fetchUser(id: String) async throws -> User
    func createUser(_ user: User) async throws -> User
    func updateUser(_ user: User) async throws -> User
    func deleteUser(id: String) async throws
}

// ✅ 구현체
final class DefaultUserRepository: UserRepository {
    private let apiClient: APIClient
    private let cache: CacheManager

    init(apiClient: APIClient = .shared, cache: CacheManager = .shared) {
        self.apiClient = apiClient
        self.cache = cache
    }

    func fetchUser(id: String) async throws -> User {
        // 캐시 확인
        if let cached: User = cache.get(key: "user_\(id)") {
            return cached
        }

        // API 호출
        let user: User = try await apiClient.request(
            endpoint: .user(id: id),
            method: .get
        )

        // 캐시 저장
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

### 4. 에러 처리

```swift
// ✅ 커스텀 에러 정의
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
            return "네트워크 연결을 확인해주세요"
        case .decodingError:
            return "데이터를 처리할 수 없습니다"
        case .notFound(let resource, let id):
            return "\(resource)을(를) 찾을 수 없습니다 (ID: \(id))"
        case .unauthorized:
            return "로그인이 필요합니다"
        case .serverError(let message):
            return "서버 오류: \(message)"
        case .unknown:
            return "알 수 없는 오류가 발생했습니다"
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

// ✅ Result 타입 활용
func loadData() async -> Result<User, AppError> {
    do {
        let user = try await repository.fetchUser(id: userId)
        return .success(user)
    } catch {
        return .failure(AppError.from(error))
    }
}
```

### 5. 네트워킹 (async/await)

```swift
// ✅ API 클라이언트
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

        // 인증 토큰
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

// ✅ Endpoint 정의
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

### 6. 의존성 주입

```swift
// ✅ Environment를 통한 DI (SwiftUI)
private struct UserRepositoryKey: EnvironmentKey {
    static let defaultValue: UserRepository = DefaultUserRepository()
}

extension EnvironmentValues {
    var userRepository: UserRepository {
        get { self[UserRepositoryKey.self] }
        set { self[UserRepositoryKey.self] = newValue }
    }
}

// 사용
struct ContentView: View {
    @Environment(\.userRepository) private var userRepository

    var body: some View {
        UserListView(viewModel: UserListViewModel(userRepository: userRepository))
    }
}

// ✅ Container 패턴
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

### 7. 테스트

```swift
import XCTest
@testable import MyApp

// ✅ Mock Repository
final class MockUserRepository: UserRepository {
    var fetchUsersResult: Result<[User], Error> = .success([])
    var fetchUserResult: Result<User, Error> = .failure(AppError.notFound(resource: "User", id: ""))

    func fetchUsers() async throws -> [User] {
        try fetchUsersResult.get()
    }

    func fetchUser(id: String) async throws -> User {
        try fetchUserResult.get()
    }

    // ... 다른 메서드
}

// ✅ ViewModel 테스트
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

    func test_loadUsers_성공시_users가_업데이트된다() async {
        // Given
        let expectedUsers = [
            User(id: "1", name: "테스트1", email: "test1@example.com"),
            User(id: "2", name: "테스트2", email: "test2@example.com")
        ]
        mockRepository.fetchUsersResult = .success(expectedUsers)

        // When
        await sut.loadUsers()

        // Then
        XCTAssertEqual(sut.users.count, 2)
        XCTAssertFalse(sut.isLoading)
    }

    func test_filteredUsers_검색어가_있으면_필터링된다() {
        // Given
        sut.users = [
            User(id: "1", name: "홍길동", email: "hong@example.com"),
            User(id: "2", name: "김철수", email: "kim@example.com")
        ]

        // When
        sut.searchText = "홍"

        // Then
        XCTAssertEqual(sut.filteredUsers.count, 1)
        XCTAssertEqual(sut.filteredUsers.first?.name, "홍길동")
    }
}
```

## 파일 구조

```
Project/
├── App/
│   ├── ProjectApp.swift         # 앱 진입점
│   └── DIContainer.swift        # 의존성 컨테이너
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

## 체크리스트

- [ ] @Observable 또는 @ObservableObject 사용
- [ ] MVVM 패턴 준수
- [ ] async/await로 비동기 처리
- [ ] Protocol로 의존성 추상화
- [ ] @MainActor로 UI 업데이트 보장
- [ ] LocalizedError로 에러 메시지 정의
- [ ] @ViewBuilder로 조건부 뷰 분리
- [ ] 테스트 가능한 구조 (Mock 주입)
