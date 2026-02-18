# 🅰️ TypeScript + Angular Quality Rules

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

## Angular Architecture

```
┌─────────────────────────────────────────────┐
│  Component (UI + Logic)                     │
│  - Template, styles, event handling         │
├─────────────────────────────────────────────┤
│  Service (Business Logic)                   │
│  - API calls, state management, utilities   │
├─────────────────────────────────────────────┤
│  Module (Feature Organization)              │
│  - Group components, services, routes       │
└─────────────────────────────────────────────┘
```

## TypeScript/Angular Patterns

### 1. Standalone Component (Angular 17+)

```typescript
// ✅ Standalone Component (Recommended)
@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card">
      <h2>{{ user().name }}</h2>
      <p>{{ user().email }}</p>
      <button (click)="onEdit()">Edit</button>
    </div>
  `,
  styles: [`
    .card {
      padding: 1rem;
      border: 1px solid #ccc;
      border-radius: 8px;
    }
  `]
})
export class UserCardComponent {
  user = input.required<User>();
  edit = output<User>();

  onEdit(): void {
    this.edit.emit(this.user());
  }
}

// ❌ NgModule-based (Legacy)
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule],
  exports: [UserCardComponent],
})
export class UserModule {}
```

### 2. Signal-based State Management (Angular 17+)

```typescript
// ✅ Using Signals
@Component({
  selector: 'app-counter',
  standalone: true,
  template: `
    <div>
      <p>Count: {{ count() }}</p>
      <p>Double: {{ doubleCount() }}</p>
      <button (click)="increment()">+</button>
      <button (click)="decrement()">-</button>
    </div>
  `
})
export class CounterComponent {
  count = signal(0);
  doubleCount = computed(() => this.count() * 2);

  increment(): void {
    this.count.update(c => c + 1);
  }

  decrement(): void {
    this.count.update(c => c - 1);
  }
}

// ✅ Service with Signals
@Injectable({ providedIn: 'root' })
export class UserStore {
  private readonly _users = signal<User[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly users = this._users.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly activeUsers = computed(() =>
    this._users().filter(u => u.isActive)
  );

  async loadUsers(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const users = await this.http.get<User[]>('/api/users').toPromise();
      this._users.set(users ?? []);
    } catch (e) {
      this._error.set('Failed to load users');
    } finally {
      this._loading.set(false);
    }
  }

  addUser(user: User): void {
    this._users.update(users => [...users, user]);
  }
}
```

### 3. New Control Flow (Angular 17+)

```typescript
// ✅ New @if, @for, @switch
@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `
    @if (loading()) {
      <app-spinner />
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      <ul>
        @for (user of users(); track user.id) {
          <li>{{ user.name }}</li>
        } @empty {
          <li>No users found</li>
        }
      </ul>
    }

    @switch (status()) {
      @case ('active') {
        <span class="badge-active">Active</span>
      }
      @case ('inactive') {
        <span class="badge-inactive">Inactive</span>
      }
      @default {
        <span>Unknown</span>
      }
    }
  `
})
export class UserListComponent {
  users = input.required<User[]>();
  loading = input(false);
  error = input<string | null>(null);
  status = input<'active' | 'inactive' | null>(null);
}

// ❌ Old *ngIf, *ngFor (Legacy)
// <div *ngIf="loading">...</div>
// <li *ngFor="let user of users">...</li>
```

### 4. HTTP Client + Error Handling

```typescript
// ✅ HTTP Service
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/users';

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl).pipe(
      catchError(this.handleError)
    );
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  create(user: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.baseUrl, user).pipe(
      catchError(this.handleError)
    );
  }

  update(id: string, user: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.baseUrl}/${id}`, user).pipe(
      catchError(this.handleError)
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An error occurred';
    if (error.status === 404) {
      message = 'Resource not found';
    } else if (error.status === 401) {
      message = 'Unauthorized';
    } else if (error.error?.message) {
      message = error.error.message;
    }
    return throwError(() => new Error(message));
  }
}
```

### 5. Reactive Forms

```typescript
// ✅ Typed Reactive Forms
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="name" placeholder="Name">
      @if (form.controls.name.errors?.['required']) {
        <span class="error">Name is required</span>
      }

      <input formControlName="email" type="email" placeholder="Email">
      @if (form.controls.email.errors?.['email']) {
        <span class="error">Invalid email</span>
      }

      <button type="submit" [disabled]="form.invalid || submitting()">
        {{ submitting() ? 'Saving...' : 'Save' }}
      </button>
    </form>
  `
})
export class UserFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly userService = inject(UserService);

  submitting = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    age: [null as number | null, [Validators.min(0), Validators.max(150)]],
  });

  onSubmit(): void {
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.userService.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.form.reset();
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }
}
```

### 6. Route Configuration (Standalone)

```typescript
// ✅ app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'users',
    loadChildren: () => import('./user/user.routes').then(m => m.userRoutes),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'home' },
];

// ✅ user.routes.ts (Lazy loaded)
export const userRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list.component').then(m => m.UserListComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./user-detail.component').then(m => m.UserDetailComponent),
    resolve: { user: userResolver },
  },
];

// ✅ Functional Guard
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

// ✅ Functional Resolver
export const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService);
  const id = route.paramMap.get('id')!;
  return userService.getById(id);
};
```

### 7. Dependency Injection (inject function)

```typescript
// ✅ Using inject() function (Recommended)
@Component({
  selector: 'app-user-page',
  standalone: true,
  template: `...`
})
export class UserPageComponent {
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  user = toSignal(
    this.route.paramMap.pipe(
      switchMap(params => this.userService.getById(params.get('id')!))
    )
  );
}

// ❌ Constructor injection (Legacy)
export class UserPageComponent {
  constructor(
    private userService: UserService,
    private route: ActivatedRoute,
  ) {}
}
```

### 8. Error Boundaries + Loading

```typescript
// ✅ defer + loading/error handling
@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    @defer (on viewport) {
      <app-heavy-chart [data]="chartData()" />
    } @placeholder {
      <div class="skeleton">Loading chart...</div>
    } @loading (minimum 500ms) {
      <app-spinner />
    } @error {
      <p>Failed to load chart</p>
    }
  `
})
export class DashboardComponent {
  chartData = signal<ChartData | null>(null);
}
```

## Recommended Folder Structure

```
src/app/
├── app.component.ts
├── app.config.ts
├── app.routes.ts
├── core/                   # Singleton services
│   ├── auth/
│   ├── http/
│   └── guards/
├── shared/                 # Shared components
│   ├── components/
│   ├── directives/
│   └── pipes/
├── features/               # Feature modules
│   ├── user/
│   │   ├── user-list.component.ts
│   │   ├── user-detail.component.ts
│   │   ├── user.service.ts
│   │   └── user.routes.ts
│   └── product/
└── models/                 # Types/Interfaces
    └── user.model.ts
```

## Checklist

- [ ] Use Standalone Components
- [ ] Signal-based state management
- [ ] New Control Flow (@if, @for)
- [ ] DI with inject() function
- [ ] Typed Reactive Forms
- [ ] Lazy Loading Routes
- [ ] Functional Guard/Resolver
- [ ] OnPush Change Detection
- [ ] Use trackBy function (@for track)
- [ ] Proper error handling
