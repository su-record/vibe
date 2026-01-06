# 🎯 Dart + Flutter 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, build() ≤ 50줄
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Dart/Flutter 특화 규칙

### 1. Immutability 우선 (@immutable)

```dart
// ❌ Mutable 클래스
class User {
  String name;
  int age;

  User({required this.name, required this.age});
}

// ✅ Immutable 클래스 + copyWith
@immutable
class User {
  const User({
    required this.name,
    required this.age,
  });

  final String name;
  final int age;

  User copyWith({
    String? name,
    int? age,
  }) {
    return User(
      name: name ?? this.name,
      age: age ?? this.age,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is User && name == other.name && age == other.age;

  @override
  int get hashCode => name.hashCode ^ age.hashCode;
}
```

### 2. StatelessWidget 선호

```dart
// ✅ StatelessWidget (순수 위젯)
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.imageUrl,
    this.size = 40.0,
    this.onTap,
  });

  final String imageUrl;
  final double size;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: CircleAvatar(
        radius: size / 2,
        backgroundImage: NetworkImage(imageUrl),
      ),
    );
  }
}

// ❌ StatefulWidget 남용 (상태가 없는데 사용)
class UserAvatar extends StatefulWidget {
  // 상태 관리 불필요
}
```

### 3. Provider 패턴 (상태 관리)

```dart
// ✅ Immutable State + ChangeNotifier
@immutable
class FeedState {
  const FeedState({
    this.feeds = const [],
    this.isLoading = false,
    this.error,
  });

  final List<Feed> feeds;
  final bool isLoading;
  final String? error;

  FeedState copyWith({
    List<Feed>? feeds,
    bool? isLoading,
    String? error,
  }) {
    return FeedState(
      feeds: feeds ?? this.feeds,
      isLoading: isLoading ?? this.isLoading,
      error: error ?? this.error,
    );
  }
}

class FeedProvider extends ChangeNotifier {
  FeedState _state = const FeedState();
  FeedState get state => _state;

  final FeedService _feedService;

  FeedProvider(this._feedService);

  Future<void> loadFeeds() async {
    _state = _state.copyWith(isLoading: true, error: null);
    notifyListeners();

    try {
      final feeds = await _feedService.getFeeds();
      _state = _state.copyWith(feeds: feeds, isLoading: false);
    } catch (e) {
      _state = _state.copyWith(error: e.toString(), isLoading: false);
    }
    notifyListeners();
  }
}

// 사용
class FeedScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final feedState = context.watch<FeedProvider>().state;

    if (feedState.isLoading) return const CircularProgressIndicator();
    if (feedState.error != null) return ErrorWidget(feedState.error!);

    return FeedList(feeds: feedState.feeds);
  }
}
```

### 4. Null Safety 명확히

```dart
// ✅ Null safety 활용
class User {
  User({
    required this.id,        // Non-nullable (필수)
    required this.name,
    this.bio,                // Nullable (선택)
  });

  final String id;
  final String name;
  final String? bio;        // ? 명시

  String getBioOrDefault() {
    return bio ?? 'No bio';  // ?? 연산자
  }

  void printBio() {
    bio?.length;             // ?. 안전 호출
  }
}

// ✅ Late 변수 (초기화 지연)
class MyWidget extends StatefulWidget {
  @override
  State<MyWidget> createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  late AnimationController _controller;  // initState에서 초기화

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }
}
```

### 5. 위젯 분리 (Extract Widget)

```dart
// ❌ 긴 build 메서드 (80줄)
class UserProfile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 30줄: 헤더
        Container(...),
        // 25줄: 통계
        Row(...),
        // 25줄: 피드 리스트
        ListView(...),
      ],
    );
  }
}

// ✅ 서브 위젯으로 분리
class UserProfile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const ProfileHeader(),
        const ProfileStats(),
        const ProfileFeedList(),
      ],
    );
  }
}

class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key});

  @override
  Widget build(BuildContext context) {
    // 헤더만
  }
}

class ProfileStats extends StatelessWidget {
  const ProfileStats({super.key});

  @override
  Widget build(BuildContext context) {
    // 통계만
  }
}
```

### 6. 순수 함수 (Static Methods)

```dart
// ✅ 순수 함수 (상태 없음)
class DateUtils {
  // Private constructor (인스턴스 생성 방지)
  DateUtils._();

  static String formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 0) return '${difference.inDays}일 전';
    if (difference.inHours > 0) return '${difference.inHours}시간 전';
    return '${difference.inMinutes}분 전';
  }

  static bool isToday(DateTime dateTime) {
    final now = DateTime.now();
    return dateTime.year == now.year &&
           dateTime.month == now.month &&
           dateTime.day == now.day;
  }
}

// 사용
final formatted = DateUtils.formatRelativeTime(feed.createdAt);
```

### 7. 에러 처리 (Result/Either 패턴)

```dart
// ✅ Result 타입으로 에러 처리
sealed class Result<T> {
  const Result();
}

class Success<T> extends Result<T> {
  const Success(this.value);
  final T value;
}

class Failure<T> extends Result<T> {
  const Failure(this.error);
  final String error;
}

// 사용
Future<Result<User>> login(String email, String password) async {
  try {
    final user = await _authService.login(email, password);
    return Success(user);
  } catch (e) {
    return Failure(e.toString());
  }
}

// 호출부 (Pattern matching)
final result = await login(email, password);
switch (result) {
  case Success(:final value):
    Navigator.pushReplacement(context, HomePage(user: value));
  case Failure(:final error):
    showErrorDialog(context, error);
}
```

### 8. Extension Methods

```dart
// ✅ Extension으로 기능 확장
extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }

  bool get isEmail {
    final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
    return emailRegex.hasMatch(this);
  }
}

extension ListExtension<T> on List<T> {
  List<T> distinctBy<K>(K Function(T) keySelector) {
    final seen = <K>{};
    return where((item) => seen.add(keySelector(item))).toList();
  }
}

// 사용
final name = 'john'.capitalize();  // 'John'
final isValid = 'test@example.com'.isEmail;  // true
```

### 9. const Constructor 활용

```dart
// ✅ const constructor (컴파일 타임 상수)
class AppColors {
  const AppColors._();

  static const primary = Color(0xFF6200EE);
  static const secondary = Color(0xFF03DAC6);
  static const error = Color(0xFFB00020);
}

class Spacing {
  const Spacing._();

  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

// ✅ const 위젯 (재사용 시 성능 향상)
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }
}

// 사용
const LoadingIndicator()  // const로 생성
```

### 10. 비동기 처리 (Future/Stream)

```dart
// ✅ Future (단일 비동기 작업)
Future<List<Feed>> fetchFeeds() async {
  final response = await dio.get('/api/feeds');
  return (response.data as List)
      .map((json) => Feed.fromJson(json))
      .toList();
}

// ✅ Stream (연속 비동기 이벤트)
Stream<List<Feed>> watchFeeds() {
  return Stream.periodic(
    const Duration(seconds: 30),
    (_) => fetchFeeds(),
  ).asyncMap((future) => future);
}

// ✅ StreamBuilder 사용
class FeedStream extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Feed>>(
      stream: watchFeeds(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingIndicator();
        }
        if (snapshot.hasError) {
          return ErrorWidget(snapshot.error.toString());
        }
        if (!snapshot.hasData) {
          return const EmptyState();
        }

        return FeedList(feeds: snapshot.data!);
      },
    );
  }
}
```

## 안티패턴

```dart
// ❌ Mutable state
class BadCounter extends StatefulWidget {
  int count = 0;  // 위험! StatefulWidget은 재생성될 수 있음

  @override
  State<BadCounter> createState() => _BadCounterState();
}

// ❌ BuildContext를 async gap 너머에서 사용
Future<void> badNavigate() async {
  await Future.delayed(Duration(seconds: 1));
  Navigator.push(context, ...);  // ❌ context가 무효화됐을 수 있음
}

// ✅ mounted 체크
Future<void> goodNavigate() async {
  await Future.delayed(Duration(seconds: 1));
  if (!mounted) return;
  Navigator.push(context, ...);
}

// ❌ setState에서 긴 작업
setState(() {
  // 10줄의 복잡한 계산  ❌
});

// ✅ 계산 후 setState
final newValue = expensiveCalculation();
setState(() {
  _value = newValue;  // 간단한 할당만
});

// ❌ GlobalKey 남용
final GlobalKey<FormState> _formKey = GlobalKey();

// ✅ Controller 사용
final TextEditingController _controller = TextEditingController();
```

## 코드 품질 도구

```bash
# 분석
flutter analyze

# 포맷팅
dart format .

# 테스트
flutter test
flutter test --coverage

# 빌드
flutter build apk --release
flutter build ios --release
flutter build web --release
```

## 체크리스트

Dart/Flutter 코드 작성 시:

- [ ] @immutable + copyWith 패턴
- [ ] StatelessWidget 우선 사용
- [ ] Provider로 상태 관리 분리
- [ ] Null safety (?, ??, ?., !)
- [ ] build() ≤ 50줄 (위젯 분리)
- [ ] 순수 함수 (static methods)
- [ ] Result 타입으로 에러 처리
- [ ] Extension methods 활용
- [ ] const constructor 사용
- [ ] Future/Stream 적절히 선택
- [ ] 복잡도 ≤ 10
