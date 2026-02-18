# 🎮 GDScript + Godot 4 Quality Rules

## Core Principles (inherited from core)

```markdown
✅ Single Responsibility (SRP)
✅ Don't Repeat Yourself (DRY)
✅ Reusability
✅ Low Complexity
✅ Functions ≤ 30 lines
✅ Nesting ≤ 3 levels
✅ Cyclomatic complexity ≤ 10
```

## Godot Architecture

```
┌─────────────────────────────────────────────┐
│  Node (Scene Tree Building Block)           │
│  - Composition over inheritance             │
│  - Signals for communication                │
├─────────────────────────────────────────────┤
│  Scene (Reusable Node Tree)                 │
│  - Prefab equivalent                        │
│  - Instantiate at runtime                   │
├─────────────────────────────────────────────┤
│  Autoload (Singleton)                       │
│  - Global state, managers                   │
│  - Use sparingly                            │
└─────────────────────────────────────────────┘
```

## GDScript 2.0 Patterns (Godot 4)

### 1. Type Annotations (Always Use)

```gdscript
# ✅ Typed GDScript
extends CharacterBody2D
class_name Player

@export var speed: float = 200.0
@export var jump_force: float = 400.0

var health: int = 100
var is_dead: bool = false
var inventory: Array[Item] = []
var stats: Dictionary = {}

func take_damage(amount: int) -> void:
    health -= amount
    if health <= 0:
        die()

func get_damage_multiplier() -> float:
    return 1.0 + (stats.get("strength", 0) * 0.1)

# ❌ Untyped (avoid)
var speed = 200
func take_damage(amount):
    pass
```

### 2. Signal Pattern

```gdscript
# ✅ Signal definitions
extends Node
class_name Player

signal health_changed(new_health: int, max_health: int)
signal died
signal item_collected(item: Item)
signal level_up(new_level: int)

@export var max_health: int = 100
var _health: int = max_health

var health: int:
    get:
        return _health
    set(value):
        var old_health := _health
        _health = clampi(value, 0, max_health)
        if _health != old_health:
            health_changed.emit(_health, max_health)
        if _health <= 0 and old_health > 0:
            died.emit()

func _ready() -> void:
    # Connect signals
    health_changed.connect(_on_health_changed)
    died.connect(_on_died)

func _on_health_changed(new_health: int, _max: int) -> void:
    print("Health: %d" % new_health)

func _on_died() -> void:
    queue_free()
```

### 3. State Machine Pattern

```gdscript
# state_machine.gd
extends Node
class_name StateMachine

signal state_changed(from_state: String, to_state: String)

@export var initial_state: State
var current_state: State
var states: Dictionary = {}

func _ready() -> void:
    for child in get_children():
        if child is State:
            states[child.name.to_lower()] = child
            child.state_machine = self

    if initial_state:
        current_state = initial_state
        current_state.enter()

func _process(delta: float) -> void:
    if current_state:
        current_state.update(delta)

func _physics_process(delta: float) -> void:
    if current_state:
        current_state.physics_update(delta)

func change_state(new_state_name: String) -> void:
    var new_state: State = states.get(new_state_name.to_lower())
    if not new_state:
        push_error("State not found: " + new_state_name)
        return

    if current_state:
        current_state.exit()

    var old_state_name := current_state.name if current_state else ""
    current_state = new_state
    current_state.enter()
    state_changed.emit(old_state_name, new_state_name)

# state.gd
extends Node
class_name State

var state_machine: StateMachine

func enter() -> void:
    pass

func exit() -> void:
    pass

func update(_delta: float) -> void:
    pass

func physics_update(_delta: float) -> void:
    pass

# player_idle_state.gd
extends State

@onready var player: Player = owner

func enter() -> void:
    player.animation_player.play("idle")

func update(_delta: float) -> void:
    if Input.is_action_pressed("move_left") or Input.is_action_pressed("move_right"):
        state_machine.change_state("walk")

    if Input.is_action_just_pressed("jump"):
        state_machine.change_state("jump")
```

### 4. Object Pool Pattern

```gdscript
# object_pool.gd
extends Node
class_name ObjectPool

@export var scene: PackedScene
@export var initial_size: int = 10
@export var max_size: int = 50

var _pool: Array[Node] = []
var _active: Array[Node] = []

func _ready() -> void:
    for i in initial_size:
        _create_instance()

func get_object() -> Node:
    var obj: Node

    if _pool.is_empty():
        if _active.size() < max_size:
            obj = _create_instance()
        else:
            push_warning("Pool exhausted")
            return null
    else:
        obj = _pool.pop_back()

    _active.append(obj)
    obj.set_process(true)
    obj.set_physics_process(true)
    obj.show()

    return obj

func return_object(obj: Node) -> void:
    if obj not in _active:
        return

    _active.erase(obj)
    _pool.append(obj)
    obj.set_process(false)
    obj.set_physics_process(false)
    obj.hide()

    if obj.has_method("reset"):
        obj.reset()

func _create_instance() -> Node:
    var obj := scene.instantiate()
    add_child(obj)
    obj.set_process(false)
    obj.set_physics_process(false)
    obj.hide()
    _pool.append(obj)
    return obj
```

### 5. Resource Pattern (Data Containers)

```gdscript
# item_data.gd
extends Resource
class_name ItemData

@export var id: String
@export var name: String
@export var description: String
@export var icon: Texture2D
@export var max_stack: int = 99
@export var value: int = 0
@export_category("Combat")
@export var damage: int = 0
@export var defense: int = 0

func get_tooltip() -> String:
    var text := "[b]%s[/b]\n%s" % [name, description]
    if damage > 0:
        text += "\n[color=red]Damage: %d[/color]" % damage
    if defense > 0:
        text += "\n[color=blue]Defense: %d[/color]" % defense
    return text

# weapon_data.gd
extends ItemData
class_name WeaponData

@export var attack_speed: float = 1.0
@export var range: float = 50.0
@export var projectile_scene: PackedScene
```

### 6. Component Pattern

```gdscript
# health_component.gd
extends Node
class_name HealthComponent

signal health_changed(current: int, maximum: int)
signal died
signal damage_taken(amount: int)
signal healed(amount: int)

@export var max_health: int = 100
@export var invincibility_time: float = 0.5

var current_health: int
var _invincible: bool = false

func _ready() -> void:
    current_health = max_health

func take_damage(amount: int, ignore_invincibility: bool = false) -> void:
    if _invincible and not ignore_invincibility:
        return

    var actual_damage := mini(amount, current_health)
    current_health -= actual_damage
    damage_taken.emit(actual_damage)
    health_changed.emit(current_health, max_health)

    if current_health <= 0:
        died.emit()
    elif invincibility_time > 0:
        _start_invincibility()

func heal(amount: int) -> void:
    var actual_heal := mini(amount, max_health - current_health)
    current_health += actual_heal
    healed.emit(actual_heal)
    health_changed.emit(current_health, max_health)

func _start_invincibility() -> void:
    _invincible = true
    await get_tree().create_timer(invincibility_time).timeout
    _invincible = false

# Usage
# var health_comp := $HealthComponent as HealthComponent
# health_comp.died.connect(_on_died)
# health_comp.take_damage(10)
```

### 7. Autoload (Singleton) Pattern

```gdscript
# game_manager.gd (Autoload)
extends Node

signal game_paused
signal game_resumed
signal score_changed(new_score: int)

var score: int = 0:
    set(value):
        score = value
        score_changed.emit(score)

var is_paused: bool = false

func pause_game() -> void:
    get_tree().paused = true
    is_paused = true
    game_paused.emit()

func resume_game() -> void:
    get_tree().paused = false
    is_paused = false
    game_resumed.emit()

func toggle_pause() -> void:
    if is_paused:
        resume_game()
    else:
        pause_game()

func add_score(amount: int) -> void:
    score += amount

func reset() -> void:
    score = 0
    is_paused = false

# audio_manager.gd (Autoload)
extends Node

@onready var music_player: AudioStreamPlayer = $MusicPlayer
@onready var sfx_players: Array[AudioStreamPlayer] = [$SFX1, $SFX2, $SFX3, $SFX4]

var _sfx_index: int = 0

func play_music(stream: AudioStream, volume_db: float = 0.0) -> void:
    music_player.stream = stream
    music_player.volume_db = volume_db
    music_player.play()

func play_sfx(stream: AudioStream, volume_db: float = 0.0) -> void:
    var player := sfx_players[_sfx_index]
    player.stream = stream
    player.volume_db = volume_db
    player.play()
    _sfx_index = (_sfx_index + 1) % sfx_players.size()
```

### 8. Input Handling

```gdscript
# player_controller.gd
extends CharacterBody2D
class_name PlayerController

@export var speed: float = 200.0
@export var acceleration: float = 1000.0
@export var friction: float = 800.0
@export var jump_force: float = 400.0

var _input_direction: Vector2 = Vector2.ZERO

func _process(_delta: float) -> void:
    _input_direction = Input.get_vector(
        "move_left", "move_right",
        "move_up", "move_down"
    )

func _physics_process(delta: float) -> void:
    # Horizontal movement
    if _input_direction.x != 0:
        velocity.x = move_toward(
            velocity.x,
            _input_direction.x * speed,
            acceleration * delta
        )
    else:
        velocity.x = move_toward(velocity.x, 0, friction * delta)

    # Gravity
    if not is_on_floor():
        velocity.y += get_gravity().y * delta

    # Jump
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = -jump_force

    move_and_slide()
```

## Project Structure

```
project/
├── project.godot
├── addons/
├── assets/
│   ├── sprites/
│   ├── audio/
│   └── fonts/
├── scenes/
│   ├── main.tscn
│   ├── levels/
│   ├── ui/
│   └── entities/
│       ├── player/
│       │   ├── player.tscn
│       │   └── player.gd
│       └── enemies/
├── scripts/
│   ├── autoloads/
│   ├── components/
│   ├── resources/
│   └── state_machine/
└── resources/
    ├── items/
    └── characters/
```

## Checklist

- [ ] Use type annotations everywhere
- [ ] Use signals for decoupled communication
- [ ] Prefer composition over inheritance
- [ ] Use Resources for data
- [ ] Use Object Pools for frequently spawned objects
- [ ] Implement State Machine for complex behaviors
- [ ] Use Components for reusable functionality
- [ ] Minimize Autoloads (singletons)
- [ ] Cache node references with @onready
- [ ] Handle input in _process, physics in _physics_process
