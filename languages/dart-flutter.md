# Dart + Flutter Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, build() <= 50 lines
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Dart/Flutter Specific Rules

### 1. Immutability First (@immutable)

```dart
// Bad: Mutable class
class User {
  String name;
  int age;

  User({required this.name, required this.age});
}

// Good: Immutable class + copyWith
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

### 2. Prefer StatelessWidget

```dart
// Good: StatelessWidget (pure widget)
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

// Bad: Overusing StatefulWidget (using it without state)
class UserAvatar extends StatefulWidget {
  // State management unnecessary
}
```

### 3. Provider Pattern (State Management)

```dart
// Good: Immutable State + ChangeNotifier
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

// Usage
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

### 4. Null Safety Clearly

```dart
// Good: Null safety usage
class User {
  User({
    required this.id,        // Non-nullable (required)
    required this.name,
    this.bio,                // Nullable (optional)
  });

  final String id;
  final String name;
  final String? bio;        // ? explicit

  String getBioOrDefault() {
    return bio ?? 'No bio';  // ?? operator
  }

  void printBio() {
    bio?.length;             // ?. safe call
  }
}

// Good: Late variable (deferred initialization)
class MyWidget extends StatefulWidget {
  @override
  State<MyWidget> createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  late AnimationController _controller;  // Initialize in initState

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

### 5. Widget Separation (Extract Widget)

```dart
// Bad: Long build method (80 lines)
class UserProfile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 30 lines: header
        Container(...),
        // 25 lines: stats
        Row(...),
        // 25 lines: feed list
        ListView(...),
      ],
    );
  }
}

// Good: Separate into sub-widgets
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
    // Header only
  }
}

class ProfileStats extends StatelessWidget {
  const ProfileStats({super.key});

  @override
  Widget build(BuildContext context) {
    // Stats only
  }
}
```

### 6. Pure Functions (Static Methods)

```dart
// Good: Pure function (no state)
class DateUtils {
  // Private constructor (prevent instantiation)
  DateUtils._();

  static String formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 0) return '${difference.inDays} days ago';
    if (difference.inHours > 0) return '${difference.inHours} hours ago';
    return '${difference.inMinutes} minutes ago';
  }

  static bool isToday(DateTime dateTime) {
    final now = DateTime.now();
    return dateTime.year == now.year &&
           dateTime.month == now.month &&
           dateTime.day == now.day;
  }
}

// Usage
final formatted = DateUtils.formatRelativeTime(feed.createdAt);
```

### 7. Error Handling (Result/Either Pattern)

```dart
// Good: Result type for error handling
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

// Usage
Future<Result<User>> login(String email, String password) async {
  try {
    final user = await _authService.login(email, password);
    return Success(user);
  } catch (e) {
    return Failure(e.toString());
  }
}

// Caller (Pattern matching)
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
// Good: Extend functionality with Extension
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

// Usage
final name = 'john'.capitalize();  // 'John'
final isValid = 'test@example.com'.isEmail;  // true
```

### 9. Using const Constructor

```dart
// Good: const constructor (compile-time constant)
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

// Good: const widget (performance improvement on reuse)
class LoadingIndicator extends StatelessWidget {
  const LoadingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: CircularProgressIndicator(),
    );
  }
}

// Usage
const LoadingIndicator()  // Create with const
```

### 10. Async Processing (Future/Stream)

```dart
// Good: Future (single async operation)
Future<List<Feed>> fetchFeeds() async {
  final response = await dio.get('/api/feeds');
  return (response.data as List)
      .map((json) => Feed.fromJson(json))
      .toList();
}

// Good: Stream (continuous async events)
Stream<List<Feed>> watchFeeds() {
  return Stream.periodic(
    const Duration(seconds: 30),
    (_) => fetchFeeds(),
  ).asyncMap((future) => future);
}

// Good: StreamBuilder usage
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

## Anti-patterns

```dart
// Bad: Mutable state
class BadCounter extends StatefulWidget {
  int count = 0;  // Dangerous! StatefulWidget can be recreated

  @override
  State<BadCounter> createState() => _BadCounterState();
}

// Bad: Using BuildContext across async gap
Future<void> badNavigate() async {
  await Future.delayed(Duration(seconds: 1));
  Navigator.push(context, ...);  // Bad: context might be invalidated
}

// Good: Check mounted
Future<void> goodNavigate() async {
  await Future.delayed(Duration(seconds: 1));
  if (!mounted) return;
  Navigator.push(context, ...);
}

// Bad: Long operations in setState
setState(() {
  // 10 lines of complex calculation  Bad
});

// Good: Calculate then setState
final newValue = expensiveCalculation();
setState(() {
  _value = newValue;  // Simple assignment only
});

// Bad: Overusing GlobalKey
final GlobalKey<FormState> _formKey = GlobalKey();

// Good: Use Controller
final TextEditingController _controller = TextEditingController();
```

## Code Quality Tools

```bash
# Analysis
flutter analyze

# Formatting
dart format .

# Testing
flutter test
flutter test --coverage

# Build
flutter build apk --release
flutter build ios --release
flutter build web --release
```

## Checklist

When writing Dart/Flutter code:

- [ ] @immutable + copyWith pattern
- [ ] Prefer StatelessWidget
- [ ] Separate state management with Provider
- [ ] Null safety (?, ??, ?., !)
- [ ] build() <= 50 lines (extract widgets)
- [ ] Pure functions (static methods)
- [ ] Result type for error handling
- [ ] Use extension methods
- [ ] Use const constructor
- [ ] Choose Future/Stream appropriately
- [ ] Complexity <= 10
