# C# + Unity Quality Rules

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

## Unity Architecture Understanding

```text
MonoBehaviour Lifecycle
Awake -> OnEnable -> Start -> Update -> ...

ScriptableObject (Data Assets)
- Settings, Events, Shared Data

Pure C# Classes (Non-MonoBehaviour)
- Game Logic, Utilities
```

## C#/Unity Specific Rules

### 1. Minimize MonoBehaviour

```csharp
// Bad: All logic in MonoBehaviour
public class PlayerController : MonoBehaviour
{
    public float health;
    public float speed;
    public int gold;

    void Update()
    {
        // Movement, combat, inventory, UI update all here...
        // Hundreds of lines of code
    }
}

// Good: Separation of concerns
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

// Pure C# class
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
        // Movement logic only
    }
}
```

### 2. Using ScriptableObject

```csharp
// Good: Data Asset
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

// Good: Event Channel
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

### 3. Object Pooling

```csharp
// Good: Generic Object Pool
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

// Usage example
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

### 4. Singleton Pattern (Use with Caution)

```csharp
// Good: Safe Singleton
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

// Usage
public class GameManager : Singleton<GameManager>
{
    public GameState CurrentState { get; private set; }

    public void ChangeState(GameState newState)
    {
        CurrentState = newState;
    }
}
```

### 5. Coroutine vs async/await

```csharp
// Good: Coroutine (integrated with Unity lifecycle)
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

// Good: async/await (I/O operations)
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

### 6. Event System

```csharp
// Good: C# Events
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

// Subscription
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

### 7. Inspector Optimization

```csharp
// Good: SerializeField + private
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

    // Read-only access via public property
    public float MoveSpeed => _moveSpeed;
}

// Good: RequireComponent
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

### 8. Performance Optimization

```csharp
// Good: GetComponent Caching
public class OptimizedBehaviour : MonoBehaviour
{
    // Bad: GetComponent in Update
    void Update()
    {
        GetComponent<Rigidbody>().AddForce(Vector3.up);
    }

    // Good: Caching
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

// Good: String comparison optimization
public class TagChecker : MonoBehaviour
{
    // Bad: String comparison
    void OnTriggerEnter(Collider other)
    {
        if (other.tag == "Player") { }
    }

    // Good: Use CompareTag
    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player")) { }
    }
}

// Good: Minimize allocations
public class NoAllocExample : MonoBehaviour
{
    // Pre-allocate
    private readonly Collider[] _hitBuffer = new Collider[10];
    private readonly RaycastHit[] _rayBuffer = new RaycastHit[5];

    void CheckOverlap(Vector3 position, float radius)
    {
        // Use NonAlloc version
        int count = Physics.OverlapSphereNonAlloc(position, radius, _hitBuffer);

        for (int i = 0; i < count; i++)
        {
            // Process _hitBuffer[i]
        }
    }
}
```

## Recommended Folder Structure

```text
Assets/
├── _Project/               # Project assets
│   ├── Scripts/
│   │   ├── Core/          # Core systems
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
├── Resources/              # Runtime load (use with caution)
└── Plugins/
```

## Naming Conventions

```csharp
// Class: PascalCase
public class PlayerController { }

// Interface: I prefix
public interface IDamageable { }

// Private field: _ prefix + camelCase
private float _moveSpeed;

// SerializeField: Keep _ prefix
[SerializeField] private float _health;

// Constants: UPPER_SNAKE_CASE or PascalCase
private const float MAX_HEALTH = 100f;
private const float MaxHealth = 100f;

// Property: PascalCase
public float Health => _health;

// Method: PascalCase
public void TakeDamage(float damage) { }
```

## Checklist

- [ ] Minimize MonoBehaviour logic
- [ ] Cache GetComponent results
- [ ] Unsubscribe events (OnDisable)
- [ ] Apply object pooling
- [ ] Use SerializeField + private
- [ ] Use CompareTag
- [ ] Use NonAlloc APIs
- [ ] Minimize Update (only when needed)
- [ ] Separate data with ScriptableObject
