# Python + Django Quality Rules

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

## Django Specific Rules

### 1. Model Design

```python
# Good: models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class BaseModel(models.Model):
    """Abstract model with common fields"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class User(AbstractUser):
    """Custom user model"""
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    profile_image = models.ImageField(upload_to='profiles/', blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email


class Post(BaseModel):
    """Post model"""
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts',
        verbose_name='Author'
    )
    title = models.CharField(max_length=200, verbose_name='Title')
    content = models.TextField(verbose_name='Content')
    is_published = models.BooleanField(default=False, verbose_name='Published')
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at']
        verbose_name = 'Post'
        verbose_name_plural = 'Posts'

    def __str__(self):
        return self.title

    def publish(self):
        """Publish the post"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save(update_fields=['is_published', 'published_at'])
```

### 2. View (Class-Based Views Recommended)

```python
# Good: views.py
from django.views.generic import ListView, DetailView, CreateView, UpdateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from .models import Post
from .forms import PostForm


class PostListView(ListView):
    """Post list view"""
    model = Post
    template_name = 'posts/list.html'
    context_object_name = 'posts'
    paginate_by = 10

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(is_published=True).select_related('author')


class PostDetailView(DetailView):
    """Post detail view"""
    model = Post
    template_name = 'posts/detail.html'
    context_object_name = 'post'

    def get_queryset(self):
        return super().get_queryset().select_related('author')


class PostCreateView(LoginRequiredMixin, CreateView):
    """Post creation view"""
    model = Post
    form_class = PostForm
    template_name = 'posts/form.html'
    success_url = reverse_lazy('posts:list')

    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)
```

### 3. Django REST Framework

```python
# Good: serializers.py
from rest_framework import serializers
from .models import Post, User


class UserSerializer(serializers.ModelSerializer):
    """User serializer"""
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'profile_image']
        read_only_fields = ['id']


class PostSerializer(serializers.ModelSerializer):
    """Post serializer"""
    author = UserSerializer(read_only=True)
    author_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='author',
        write_only=True
    )

    class Meta:
        model = Post
        fields = [
            'id', 'title', 'content', 'author', 'author_id',
            'is_published', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_title(self, value):
        if len(value) < 5:
            raise serializers.ValidationError('Title must be at least 5 characters')
        return value


# Good: views.py (DRF)
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend


class PostViewSet(viewsets.ModelViewSet):
    """Post ViewSet"""
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_published', 'author']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related('author')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish post action"""
        post = self.get_object()

        if post.author != request.user:
            return Response(
                {'error': 'Only the author can publish'},
                status=status.HTTP_403_FORBIDDEN
            )

        post.publish()
        return Response({'status': 'Published'})
```

### 4. Service Layer (Prevent Fat Model)

```python
# Good: services/post_service.py
from django.db import transaction
from django.core.exceptions import PermissionDenied
from ..models import Post, User


class PostService:
    """Post business logic"""

    @staticmethod
    def create_post(author: User, title: str, content: str) -> Post:
        """Create post"""
        post = Post.objects.create(
            author=author,
            title=title,
            content=content
        )
        return post

    @staticmethod
    def publish_post(post: Post, user: User) -> Post:
        """Publish post"""
        if post.author != user:
            raise PermissionDenied('Only the author can publish')

        post.publish()
        return post

    @staticmethod
    @transaction.atomic
    def bulk_publish(post_ids: list[int], user: User) -> int:
        """Bulk publish multiple posts"""
        posts = Post.objects.filter(
            id__in=post_ids,
            author=user,
            is_published=False
        )

        count = posts.update(
            is_published=True,
            published_at=timezone.now()
        )
        return count
```

### 5. Form and Validation

```python
# Good: forms.py
from django import forms
from django.core.exceptions import ValidationError
from .models import Post


class PostForm(forms.ModelForm):
    """Post form"""
    class Meta:
        model = Post
        fields = ['title', 'content', 'is_published']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Enter title'
            }),
            'content': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 10
            }),
        }

    def clean_title(self):
        title = self.cleaned_data.get('title')
        if len(title) < 5:
            raise ValidationError('Title must be at least 5 characters')
        return title

    def clean(self):
        cleaned_data = super().clean()
        title = cleaned_data.get('title')
        content = cleaned_data.get('content')

        if title and content and title in content:
            raise ValidationError('Content should not contain the title')

        return cleaned_data
```

### 6. Custom Manager and QuerySet

```python
# Good: managers.py
from django.db import models


class PostQuerySet(models.QuerySet):
    """Post QuerySet"""

    def published(self):
        return self.filter(is_published=True)

    def by_author(self, user):
        return self.filter(author=user)

    def recent(self, days=7):
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=days)
        return self.filter(created_at__gte=cutoff)


class PostManager(models.Manager):
    """Post Manager"""

    def get_queryset(self):
        return PostQuerySet(self.model, using=self._db)

    def published(self):
        return self.get_queryset().published()

    def by_author(self, user):
        return self.get_queryset().by_author(user)


# Use in model
class Post(BaseModel):
    # ... fields ...
    objects = PostManager()
```

## File Structure

```text
app_name/
├── migrations/          # DB migrations
├── management/
│   └── commands/        # Custom commands
├── services/            # Business logic
├── api/
│   ├── serializers.py   # DRF serializers
│   ├── views.py         # DRF views
│   └── urls.py          # API routing
├── templates/           # HTML templates
├── static/              # Static files
├── tests/
│   ├── test_models.py
│   ├── test_views.py
│   └── test_services.py
├── models.py            # Models (or models/ directory)
├── views.py             # Views
├── forms.py             # Forms
├── managers.py          # Custom managers
├── admin.py             # Admin configuration
├── urls.py              # URL routing
└── apps.py              # App configuration
```

## Checklist

- [ ] Define `__str__`, `Meta` in Model
- [ ] Use CBV (recommended)
- [ ] Separate business logic with Service layer
- [ ] Prevent N+1 with select_related/prefetch_related
- [ ] Validate input/output with DRF Serializer
- [ ] Use Custom Manager/QuerySet
- [ ] Use Type hints (Python 3.10+)
- [ ] Set verbose_name for fields
