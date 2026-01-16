# 🐍 Python + Django 품질 규칙

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

## Django 특화 규칙

### 1. Model 설계

```python
# ✅ models.py
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class BaseModel(models.Model):
    """공통 필드를 가진 추상 모델"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class User(AbstractUser):
    """커스텀 사용자 모델"""
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    profile_image = models.ImageField(upload_to='profiles/', blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        verbose_name = '사용자'
        verbose_name_plural = '사용자들'

    def __str__(self):
        return self.email


class Post(BaseModel):
    """게시글 모델"""
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='posts',
        verbose_name='작성자'
    )
    title = models.CharField(max_length=200, verbose_name='제목')
    content = models.TextField(verbose_name='내용')
    is_published = models.BooleanField(default=False, verbose_name='게시 여부')
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at']
        verbose_name = '게시글'
        verbose_name_plural = '게시글들'

    def __str__(self):
        return self.title

    def publish(self):
        """게시글 발행"""
        self.is_published = True
        self.published_at = timezone.now()
        self.save(update_fields=['is_published', 'published_at'])
```

### 2. View (Class-Based Views 권장)

```python
# ✅ views.py
from django.views.generic import ListView, DetailView, CreateView, UpdateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.urls import reverse_lazy
from .models import Post
from .forms import PostForm


class PostListView(ListView):
    """게시글 목록 뷰"""
    model = Post
    template_name = 'posts/list.html'
    context_object_name = 'posts'
    paginate_by = 10

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(is_published=True).select_related('author')


class PostDetailView(DetailView):
    """게시글 상세 뷰"""
    model = Post
    template_name = 'posts/detail.html'
    context_object_name = 'post'

    def get_queryset(self):
        return super().get_queryset().select_related('author')


class PostCreateView(LoginRequiredMixin, CreateView):
    """게시글 생성 뷰"""
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
# ✅ serializers.py
from rest_framework import serializers
from .models import Post, User


class UserSerializer(serializers.ModelSerializer):
    """사용자 시리얼라이저"""
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'profile_image']
        read_only_fields = ['id']


class PostSerializer(serializers.ModelSerializer):
    """게시글 시리얼라이저"""
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
            raise serializers.ValidationError('제목은 5자 이상이어야 합니다')
        return value


# ✅ views.py (DRF)
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend


class PostViewSet(viewsets.ModelViewSet):
    """게시글 ViewSet"""
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
        """게시글 발행 액션"""
        post = self.get_object()

        if post.author != request.user:
            return Response(
                {'error': '작성자만 발행할 수 있습니다'},
                status=status.HTTP_403_FORBIDDEN
            )

        post.publish()
        return Response({'status': '발행되었습니다'})
```

### 4. Service 레이어 (Fat Model 방지)

```python
# ✅ services/post_service.py
from django.db import transaction
from django.core.exceptions import PermissionDenied
from ..models import Post, User


class PostService:
    """게시글 관련 비즈니스 로직"""

    @staticmethod
    def create_post(author: User, title: str, content: str) -> Post:
        """게시글 생성"""
        post = Post.objects.create(
            author=author,
            title=title,
            content=content
        )
        return post

    @staticmethod
    def publish_post(post: Post, user: User) -> Post:
        """게시글 발행"""
        if post.author != user:
            raise PermissionDenied('작성자만 발행할 수 있습니다')

        post.publish()
        return post

    @staticmethod
    @transaction.atomic
    def bulk_publish(post_ids: list[int], user: User) -> int:
        """여러 게시글 일괄 발행"""
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

### 5. Form 및 Validation

```python
# ✅ forms.py
from django import forms
from django.core.exceptions import ValidationError
from .models import Post


class PostForm(forms.ModelForm):
    """게시글 폼"""
    class Meta:
        model = Post
        fields = ['title', 'content', 'is_published']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': '제목을 입력하세요'
            }),
            'content': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 10
            }),
        }

    def clean_title(self):
        title = self.cleaned_data.get('title')
        if len(title) < 5:
            raise ValidationError('제목은 5자 이상이어야 합니다')
        return title

    def clean(self):
        cleaned_data = super().clean()
        title = cleaned_data.get('title')
        content = cleaned_data.get('content')

        if title and content and title in content:
            raise ValidationError('본문에 제목이 포함되면 안 됩니다')

        return cleaned_data
```

### 6. Custom Manager와 QuerySet

```python
# ✅ managers.py
from django.db import models


class PostQuerySet(models.QuerySet):
    """게시글 QuerySet"""

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
    """게시글 Manager"""

    def get_queryset(self):
        return PostQuerySet(self.model, using=self._db)

    def published(self):
        return self.get_queryset().published()

    def by_author(self, user):
        return self.get_queryset().by_author(user)


# 모델에서 사용
class Post(BaseModel):
    # ... fields ...
    objects = PostManager()
```

## 파일 구조

```
app_name/
├── migrations/          # DB 마이그레이션
├── management/
│   └── commands/        # 커스텀 명령어
├── services/            # 비즈니스 로직
├── api/
│   ├── serializers.py   # DRF 시리얼라이저
│   ├── views.py         # DRF 뷰
│   └── urls.py          # API 라우팅
├── templates/           # HTML 템플릿
├── static/              # 정적 파일
├── tests/
│   ├── test_models.py
│   ├── test_views.py
│   └── test_services.py
├── models.py            # 모델 (또는 models/ 디렉토리)
├── views.py             # 뷰
├── forms.py             # 폼
├── managers.py          # 커스텀 매니저
├── admin.py             # Admin 설정
├── urls.py              # URL 라우팅
└── apps.py              # 앱 설정
```

## 체크리스트

- [ ] Model에 `__str__`, `Meta` 정의
- [ ] CBV 사용 (권장)
- [ ] Service 레이어로 비즈니스 로직 분리
- [ ] select_related/prefetch_related로 N+1 방지
- [ ] DRF Serializer로 입출력 검증
- [ ] Custom Manager/QuerySet 활용
- [ ] Type hints 사용 (Python 3.10+)
- [ ] 한글 verbose_name 설정
