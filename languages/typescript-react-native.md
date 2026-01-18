# TypeScript + React Native Quality Rules

## Core Principles (inherited from core + React)

```markdown
# Core Principles (inherited from core + React)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines, JSX <= 50 lines
All React rules apply
```

## React Native Specific Rules

### 1. Platform-specific Code Separation

```typescript
// Good: Separate by file extension
Button.ios.tsx      // iOS only
Button.android.tsx  // Android only
Button.tsx          // Common

// Good: Using Platform API
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

// Good: Platform.OS check
if (Platform.OS === 'ios') {
  // iOS specific logic
} else if (Platform.OS === 'android') {
  // Android specific logic
}
```

### 2. Use StyleSheet (Avoid Inline Styles)

```typescript
// Bad: Inline style (performance degradation)
<View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }} />

// Good: StyleSheet (optimized)
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
});

<View style={styles.container} />

// Good: Conditional styles
<View style={[
  styles.container,
  isActive && styles.active,
  { marginTop: offset }, // Inline only for dynamic values
]} />
```

### 3. FlatList Optimization

```typescript
// Good: FlatList performance optimization
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
      // Performance optimization options
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={5}
      // Sticky header
      stickyHeaderIndices={[0]}
      // List separator
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      // Empty state
      ListEmptyComponent={<EmptyState />}
    />
  );
};

// Good: UserCard memoization
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
// Good: Type-safe navigation
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Navigation type definition
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

// Good: Type-safe navigation hook
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

type HomeScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Home'
>;

function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();

  const navigateToProfile = (userId: string) => {
    navigation.navigate('UserProfile', { userId }); // Type safe
  };

  return <Button onPress={() => navigateToProfile('123')} title="Profile" />;
}
```

### 5. AsyncStorage (Data Persistence)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Good: Type-safe Storage wrapper
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

// Usage
interface User {
  id: string;
  name: string;
}

await Storage.set<User>('user', { id: '123', name: 'John' });
const user = await Storage.get<User>('user');
```

### 6. Image Optimization

```typescript
import { Image } from 'react-native';
import FastImage from 'react-native-fast-image';

// Good: Use FastImage (caching, performance)
<FastImage
  source={{
    uri: user.avatar,
    priority: FastImage.priority.high,
  }}
  style={styles.avatar}
  resizeMode={FastImage.resizeMode.cover}
/>

// Good: Local image
<Image source={require('./assets/logo.png')} style={styles.logo} />

// Good: Conditional loading
{imageUrl && (
  <Image
    source={{ uri: imageUrl }}
    defaultSource={require('./assets/placeholder.png')}
  />
)}
```

### 7. SafeAreaView (Safe Areas)

```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

// Good: Use SafeAreaView (notch/status bar handling)
function Screen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text>Content</Text>
    </SafeAreaView>
  );
}

// Good: useSafeAreaInsets hook
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

### 8. Hooks Optimization

```typescript
// Good: useCallback (event handlers)
const handlePress = useCallback(() => {
  navigation.navigate('UserProfile', { userId });
}, [navigation, userId]);

// Good: useMemo (expensive calculations)
const sortedUsers = useMemo(() => {
  return users.sort((a, b) => a.name.localeCompare(b.name));
}, [users]);

// Good: Custom Hook (logic reuse)
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

### 9. Permission Handling

```typescript
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Platform } from 'react-native';

// Good: Permission check and request
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
      // Guide to settings
      return false;
    default:
      return false;
  }
}
```

### 10. Error Boundary

```typescript
// Good: React Native Error Boundary
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
    // Error logging service (Sentry etc.)
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

## Anti-patterns

```typescript
// Bad: ScrollView for long lists
<ScrollView>
  {users.map(user => <UserCard key={user.id} user={user} />)}
</ScrollView>

// Good: Use FlatList
<FlatList data={users} renderItem={renderItem} />

// Bad: Nested FlatList (performance degradation)
<FlatList
  data={categories}
  renderItem={({ item }) => (
    <FlatList data={item.items} renderItem={renderItem} />
  )}
/>

// Good: Single FlatList + sections
<SectionList sections={sections} renderItem={renderItem} />

// Bad: Async setState in useEffect cleanup
useEffect(() => {
  return () => {
    setData(null); // Bad: setState after unmount
  };
}, []);

// Good: isMounted check
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

## Performance Optimization Tools

```bash
# Flipper (debugging)
npx react-native-flipper

# Bundle analysis
npx react-native bundle --platform android --dev false \
  --entry-file index.js --bundle-output android.bundle

# Memory profiling (use Flipper)
```

## Checklist

When writing React Native code:

- [ ] Use StyleSheet (avoid inline)
- [ ] FlatList optimization (long lists)
- [ ] Platform branching
- [ ] Type-safe Navigation
- [ ] Use SafeAreaView
- [ ] Use FastImage (images)
- [ ] useCallback/useMemo optimization
- [ ] Permission handling (camera, location, etc.)
- [ ] Apply Error Boundary
- [ ] AsyncStorage type wrapper
- [ ] Complexity <= 10
