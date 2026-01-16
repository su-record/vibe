# 📱 TypeScript + React Native 품질 규칙

## 핵심 원칙 (core + React에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄, JSX ≤ 50줄
✅ React 규칙 모두 적용
```

## React Native 특화 규칙

### 1. 플랫폼별 코드 분리

```typescript
// ✅ 파일 확장자로 분리
Button.ios.tsx      // iOS 전용
Button.android.tsx  // Android 전용
Button.tsx          // 공통

// ✅ Platform API 사용
import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});

// ✅ Platform.OS 체크
if (Platform.OS === 'ios') {
  // iOS 전용 로직
} else if (Platform.OS === 'android') {
  // Android 전용 로직
}
```

### 2. StyleSheet 사용 (인라인 스타일 지양)

```typescript
// ❌ 인라인 스타일 (성능 저하)
<View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }} />

// ✅ StyleSheet (최적화됨)
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
});

<View style={styles.container} />

// ✅ 조건부 스타일
<View style={[
  styles.container,
  isActive && styles.active,
  { marginTop: offset }, // 동적 값만 인라인
]} />
```

### 3. FlatList 최적화

```typescript
// ✅ FlatList 성능 최적화
interface User {
  id: string;
  name: string;
  avatar: string;
}

const UserList = ({ users }: { users: User[] }) => {
  const renderItem = useCallback(({ item }: { item: User }) => {
    return <UserCard user={item} />;
  }, []);

  const keyExtractor = useCallback((item: User) => item.id, []);

  return (
    <FlatList
      data={users}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      // 성능 최적화 옵션
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={5}
      // 헤더 고정
      stickyHeaderIndices={[0]}
      // 리스트 분리
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      // 빈 상태
      ListEmptyComponent={<EmptyState />}
    />
  );
};

// ✅ UserCard 메모이제이션
const UserCard = React.memo<{ user: User }>(({ user }) => {
  return (
    <View style={styles.card}>
      <Image source={{ uri: user.avatar }} style={styles.avatar} />
      <Text>{user.name}</Text>
    </View>
  );
});
```

### 4. Navigation (React Navigation)

```typescript
// ✅ 타입 안전한 네비게이션
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 네비게이션 타입 정의
type RootStackParamList = {
  Home: undefined;
  UserProfile: { userId: string };
  Settings: { section?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ✅ 타입 안전한 네비게이션 훅
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const navigateToProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId }); // 타입 안전
  };

  return <Button onPress={() => navigateToProfile('123')} title="Profile" />;
}
```

### 5. AsyncStorage (데이터 저장)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ 타입 안전한 Storage 래퍼
class Storage {
  static async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  static async get<T>(key: string): Promise<T | null> {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }

  static async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

// 사용
interface User {
  id: string;
  name: string;
}

await Storage.set<User>('user', { id: '123', name: 'John' });
const user = await Storage.get<User>('user');
```

### 6. 이미지 최적화

```typescript
import { Image } from 'react-native';
import FastImage from 'react-native-fast-image';

// ✅ FastImage 사용 (캐싱, 성능)
<FastImage
  source={{
    uri: user.avatar,
    priority: FastImage.priority.high,
  }}
  style={styles.avatar}
  resizeMode={FastImage.resizeMode.cover}
/>

// ✅ 로컬 이미지
<Image source={require('./assets/logo.png')} style={styles.logo} />

// ✅ 조건부 로딩
{imageUrl && (
  <Image
    source={{ uri: imageUrl }}
    defaultSource={require('./assets/placeholder.png')}
  />
)}
```

### 7. SafeAreaView (안전 영역)

```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ SafeAreaView 사용 (노치/상태바 대응)
function Screen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text>Content</Text>
    </SafeAreaView>
  );
}

// ✅ useSafeAreaInsets 훅
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function CustomHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingTop: insets.top }}>
      <Text>Header</Text>
    </View>
  );
}
```

### 8. Hooks 최적화

```typescript
// ✅ useCallback (이벤트 핸들러)
const handlePress = useCallback(() => {
  navigation.navigate('UserProfile', { userId });
}, [navigation, userId]);

// ✅ useMemo (무거운 계산)
const sortedUsers = useMemo(() => {
  return users.sort((a, b) => a.name.localeCompare(b.name));
}, [users]);

// ✅ Custom Hook (로직 재사용)
function useKeyboard() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return isVisible;
}
```

### 9. 권한 처리

```typescript
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

// ✅ 권한 체크 및 요청
async function requestCameraPermission(): Promise<boolean> {
  const permission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.CAMERA
      : PERMISSIONS.ANDROID.CAMERA;

  const result = await check(permission);

  switch (result) {
    case RESULTS.GRANTED:
      return true;
    case RESULTS.DENIED:
      const requested = await request(permission);
      return requested === RESULTS.GRANTED;
    case RESULTS.BLOCKED:
      // 설정으로 이동 안내
      return false;
    default:
      return false;
  }
}
```

### 10. 에러 경계 (Error Boundary)

```typescript
// ✅ React Native용 Error Boundary
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // 에러 로깅 서비스 (Sentry 등)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Something went wrong</Text>
          <Button title="Try Again" onPress={this.handleReset} />
        </View>
      );
    }

    return this.props.children;
  }
}
```

## 안티패턴

```typescript
// ❌ ScrollView로 긴 리스트
<ScrollView>
  {users.map(user => <UserCard key={user.id} user={user} />)}
</ScrollView>

// ✅ FlatList 사용
<FlatList data={users} renderItem={renderItem} />

// ❌ 중첩된 FlatList (성능 저하)
<FlatList
  data={categories}
  renderItem={({ item }) => (
    <FlatList data={item.items} renderItem={renderItem} />
  )}
/>

// ✅ 단일 FlatList + 섹션
<SectionList sections={sections} renderItem={renderItem} />

// ❌ 비동기 setState in useEffect cleanup
useEffect(() => {
  return () => {
    setData(null); // ❌ 언마운트 후 setState
  };
}, []);

// ✅ isMounted 체크
useEffect(() => {
  let isMounted = true;

  fetchData().then(data => {
    if (isMounted) setData(data);
  });

  return () => {
    isMounted = false;
  };
}, []);
```

## 성능 최적화 도구

```bash
# Flipper (디버깅)
npx react-native-flipper

# Bundle 분석
npx react-native bundle --platform android --dev false \
  --entry-file index.js --bundle-output android.bundle

# 메모리 프로파일링 (Flipper 사용)
```

## 체크리스트

React Native 코드 작성 시:

- [ ] StyleSheet 사용 (인라인 지양)
- [ ] FlatList 최적화 (긴 리스트)
- [ ] Platform 분기 처리
- [ ] 타입 안전한 Navigation
- [ ] SafeAreaView 사용
- [ ] FastImage 사용 (이미지)
- [ ] useCallback/useMemo 최적화
- [ ] 권한 처리 (카메라, 위치 등)
- [ ] Error Boundary 적용
- [ ] AsyncStorage 타입 래퍼
- [ ] 복잡도 ≤ 10
