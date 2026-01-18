# 🎮 C# + Unity 품질 규칙

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

## Unity 아키텍처 이해

```
┌─────────────────────────────────────────────┐
│  MonoBehaviour Lifecycle                    │
│  Awake → OnEnable → Start → Update → ...    │
├─────────────────────────────────────────────┤
│  ScriptableObject (데이터 에셋)              │
│  - 설정, 이벤트, 공유 데이터                 │
├─────────────────────────────────────────────┤
│  Pure C# Classes (비-MonoBehaviour)         │
│  - 게임 로직, 유틸리티                       │
└─────────────────────────────────────────────┘
```

## C#/Unity 특화 규칙

### 1. MonoBehaviour 최소화

```csharp
// ❌ 모든 로직을 MonoBehaviour에
public class PlayerController : MonoBehaviour
{
    public float health;
    public float speed;
    public int gold;

    void Update()
    {
        // 이동, 전투, 인벤토리, UI 업데이트 모두 여기에...
        // 수백 줄의 코드
    }
}

// ✅ 관심사 분리
public class PlayerController : MonoBehaviour
{
    [SerializeField] private PlayerData _data;

    private PlayerMovement _movement;
    private PlayerCombat _combat;

    private void Awake()
    {
        _movement = new PlayerMovement(_data, transform);
        _combat = new PlayerCombat(_data);
    }

    private void Update()
    {
        _movement.Update(Time.deltaTime);
    }
}

// Pure C# 클래스
public class PlayerMovement
{
    private readonly PlayerData _data;
    private readonly Transform _transform;

    public PlayerMovement(PlayerData data, Transform transform)
    {
        _data = data;
        _transform = transform;
    }

    public void Update(float deltaTime)
    {
        // 이동 로직만
    }
}
```

### 2. ScriptableObject 활용

```csharp
// ✅ 데이터 에셋
[CreateAssetMenu(fileName = "PlayerData", menuName = "Game/PlayerData")]
public class PlayerData : ScriptableObject
{
    [Header("Stats")]
    public float maxHealth = 100f;
    public float moveSpeed = 5f;

    [Header("Combat")]
    public float attackDamage = 10f;
    public float attackRange = 2f;
}

// ✅ 이벤트 채널
[CreateAssetMenu(fileName = "GameEvent", menuName = "Events/GameEvent")]
public class GameEvent : ScriptableObject
{
    private readonly List<IGameEventListener> _listeners = new();

    public void Raise()
    {
        for (int i = _listeners.Count - 1; i >= 0; i--)
        {
            _listeners[i].OnEventRaised();
        }
    }

    public void RegisterListener(IGameEventListener listener) => _listeners.Add(listener);
    public void UnregisterListener(IGameEventListener listener) => _listeners.Remove(listener);
}

public interface IGameEventListener
{
    void OnEventRaised();
}
```

### 3. 오브젝트 풀링

```csharp
// ✅ 제네릭 오브젝트 풀
public class ObjectPool<T> where T : Component
{
    private readonly T _prefab;
    private readonly Transform _parent;
    private readonly Queue<T> _pool = new();

    public ObjectPool(T prefab, Transform parent, int initialSize = 10)
    {
        _prefab = prefab;
        _parent = parent;

        for (int i = 0; i < initialSize; i++)
        {
            CreateInstance();
        }
    }

    public T Get()
    {
        T instance = _pool.Count > 0 ? _pool.Dequeue() : CreateInstance();
        instance.gameObject.SetActive(true);
        return instance;
    }

    public void Return(T instance)
    {
        instance.gameObject.SetActive(false);
        _pool.Enqueue(instance);
    }

    private T CreateInstance()
    {
        T instance = Object.Instantiate(_prefab, _parent);
        instance.gameObject.SetActive(false);
        return instance;
    }
}

// 사용 예시
public class BulletManager : MonoBehaviour
{
    [SerializeField] private Bullet _bulletPrefab;

    private ObjectPool<Bullet> _bulletPool;

    private void Awake()
    {
        _bulletPool = new ObjectPool<Bullet>(_bulletPrefab, transform, 50);
    }

    public Bullet SpawnBullet(Vector3 position, Vector3 direction)
    {
        Bullet bullet = _bulletPool.Get();
        bullet.Initialize(position, direction, () => _bulletPool.Return(bullet));
        return bullet;
    }
}
```

### 4. 싱글톤 패턴 (주의해서 사용)

```csharp
// ✅ 안전한 싱글톤
public abstract class Singleton<T> : MonoBehaviour where T : MonoBehaviour
{
    private static T _instance;
    private static readonly object _lock = new();
    private static bool _applicationIsQuitting;

    public static T Instance
    {
        get
        {
            if (_applicationIsQuitting)
            {
                Debug.LogWarning($"[Singleton] Instance of {typeof(T)} already destroyed.");
                return null;
            }

            lock (_lock)
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<T>();

                    if (_instance == null)
                    {
                        var singleton = new GameObject($"[Singleton] {typeof(T)}");
                        _instance = singleton.AddComponent<T>();
                        DontDestroyOnLoad(singleton);
                    }
                }
                return _instance;
            }
        }
    }

    protected virtual void OnApplicationQuit()
    {
        _applicationIsQuitting = true;
    }
}

// 사용
public class GameManager : Singleton<GameManager>
{
    public GameState CurrentState { get; private set; }

    public void ChangeState(GameState newState)
    {
        CurrentState = newState;
    }
}
```

### 5. 코루틴 vs async/await

```csharp
// ✅ 코루틴 (Unity 생명주기와 통합)
public class EnemySpawner : MonoBehaviour
{
    [SerializeField] private float _spawnInterval = 2f;

    private Coroutine _spawnCoroutine;

    public void StartSpawning()
    {
        _spawnCoroutine = StartCoroutine(SpawnLoop());
    }

    public void StopSpawning()
    {
        if (_spawnCoroutine != null)
        {
            StopCoroutine(_spawnCoroutine);
        }
    }

    private IEnumerator SpawnLoop()
    {
        while (true)
        {
            SpawnEnemy();
            yield return new WaitForSeconds(_spawnInterval);
        }
    }
}

// ✅ async/await (I/O 작업)
public class SaveManager : MonoBehaviour
{
    public async Task SaveGameAsync(GameSaveData data)
    {
        string json = JsonUtility.ToJson(data);
        string path = Path.Combine(Application.persistentDataPath, "save.json");

        await File.WriteAllTextAsync(path, json);
        Debug.Log("Game saved!");
    }

    public async Task<GameSaveData> LoadGameAsync()
    {
        string path = Path.Combine(Application.persistentDataPath, "save.json");

        if (!File.Exists(path))
            return null;

        string json = await File.ReadAllTextAsync(path);
        return JsonUtility.FromJson<GameSaveData>(json);
    }
}
```

### 6. 이벤트 시스템

```csharp
// ✅ C# 이벤트
public class Health : MonoBehaviour
{
    public event Action<float> OnHealthChanged;
    public event Action OnDeath;

    [SerializeField] private float _maxHealth = 100f;
    private float _currentHealth;

    public float CurrentHealth => _currentHealth;
    public float MaxHealth => _maxHealth;

    private void Awake()
    {
        _currentHealth = _maxHealth;
    }

    public void TakeDamage(float damage)
    {
        _currentHealth = Mathf.Max(0, _currentHealth - damage);
        OnHealthChanged?.Invoke(_currentHealth / _maxHealth);

        if (_currentHealth <= 0)
        {
            OnDeath?.Invoke();
        }
    }
}

// 구독
public class HealthUI : MonoBehaviour
{
    [SerializeField] private Health _health;
    [SerializeField] private Slider _healthBar;

    private void OnEnable()
    {
        _health.OnHealthChanged += UpdateHealthBar;
    }

    private void OnDisable()
    {
        _health.OnHealthChanged -= UpdateHealthBar;
    }

    private void UpdateHealthBar(float normalizedHealth)
    {
        _healthBar.value = normalizedHealth;
    }
}
```

### 7. 인스펙터 최적화

```csharp
// ✅ SerializeField + private
public class Enemy : MonoBehaviour
{
    [Header("Settings")]
    [SerializeField] private float _moveSpeed = 3f;
    [SerializeField] private float _attackRange = 1.5f;

    [Header("References")]
    [SerializeField] private Transform _target;
    [SerializeField] private Animator _animator;

    [Header("Debug")]
    [SerializeField, ReadOnly] private float _distanceToTarget;

    // public 프로퍼티로 읽기 전용 접근
    public float MoveSpeed => _moveSpeed;
}

// ✅ RequireComponent
[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(Collider))]
public class PhysicsObject : MonoBehaviour
{
    private Rigidbody _rb;

    private void Awake()
    {
        _rb = GetComponent<Rigidbody>();
    }
}
```

### 8. 성능 최적화

```csharp
// ✅ GetComponent 캐싱
public class OptimizedBehaviour : MonoBehaviour
{
    // ❌ Update에서 GetComponent 호출
    void Update()
    {
        GetComponent<Rigidbody>().AddForce(Vector3.up);
    }

    // ✅ 캐싱
    private Rigidbody _rb;

    void Awake()
    {
        _rb = GetComponent<Rigidbody>();
    }

    void Update()
    {
        _rb.AddForce(Vector3.up);
    }
}

// ✅ string 비교 최적화
public class TagChecker : MonoBehaviour
{
    // ❌ 문자열 비교
    void OnTriggerEnter(Collider other)
    {
        if (other.tag == "Player") { }
    }

    // ✅ CompareTag 사용
    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player")) { }
    }
}

// ✅ 할당 최소화
public class NoAllocExample : MonoBehaviour
{
    // 미리 할당
    private readonly Collider[] _hitBuffer = new Collider[10];
    private readonly RaycastHit[] _rayBuffer = new RaycastHit[5];

    void CheckOverlap(Vector3 position, float radius)
    {
        // NonAlloc 버전 사용
        int count = Physics.OverlapSphereNonAlloc(position, radius, _hitBuffer);

        for (int i = 0; i < count; i++)
        {
            // _hitBuffer[i] 처리
        }
    }
}
```

## 폴더 구조 권장

```
Assets/
├── _Project/               # 프로젝트 에셋
│   ├── Scripts/
│   │   ├── Core/          # 핵심 시스템
│   │   ├── Player/
│   │   ├── Enemy/
│   │   ├── UI/
│   │   └── Utils/
│   ├── Prefabs/
│   ├── ScriptableObjects/
│   │   ├── Data/
│   │   └── Events/
│   ├── Materials/
│   ├── Textures/
│   └── Audio/
├── Scenes/
├── Resources/              # 런타임 로드 (주의해서 사용)
└── Plugins/
```

## 네이밍 컨벤션

```csharp
// 클래스: PascalCase
public class PlayerController { }

// 인터페이스: I 접두사
public interface IDamageable { }

// private 필드: _ 접두사 + camelCase
private float _moveSpeed;

// SerializeField: _ 접두사 유지
[SerializeField] private float _health;

// 상수: UPPER_SNAKE_CASE 또는 PascalCase
private const float MAX_HEALTH = 100f;
private const float MaxHealth = 100f;

// 프로퍼티: PascalCase
public float Health => _health;

// 메서드: PascalCase
public void TakeDamage(float damage) { }
```

## 체크리스트

- [ ] MonoBehaviour 로직 최소화
- [ ] GetComponent 결과 캐싱
- [ ] 이벤트 구독 해제 (OnDisable)
- [ ] 오브젝트 풀링 적용
- [ ] SerializeField + private 사용
- [ ] CompareTag 사용
- [ ] NonAlloc API 사용
- [ ] Update 최소화 (필요시만)
- [ ] ScriptableObject로 데이터 분리
