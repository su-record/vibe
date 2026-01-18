# 💎 Ruby on Rails Quality Rules

## Core Principles (inherited from core)

```markdown
✅ Single Responsibility (SRP)
✅ Don't Repeat Yourself (DRY)
✅ Reusability
✅ Low Complexity
✅ Methods ≤ 30 lines
✅ Nesting ≤ 3 levels
✅ Cyclomatic complexity ≤ 10
```

## Rails Architecture (MVC)

```
┌─────────────────────────────────────────────┐
│  Controller (Request Handling)              │
│  - Thin controllers                         │
│  - Delegate to services                     │
├─────────────────────────────────────────────┤
│  Model (Business Logic + Data)              │
│  - Validations, associations               │
│  - Scopes, callbacks                        │
├─────────────────────────────────────────────┤
│  View (Presentation)                        │
│  - ERB, Slim, or ViewComponents            │
│  - Helpers, partials                        │
└─────────────────────────────────────────────┘
```

## Rails Patterns

### 1. Controller Pattern

```ruby
# ✅ Thin Controller
class UsersController < ApplicationController
  before_action :authenticate_user!
  before_action :set_user, only: [:show, :edit, :update, :destroy]

  def index
    @users = User.active.order(created_at: :desc).page(params[:page])
  end

  def show
  end

  def create
    result = Users::CreateService.call(user_params)

    if result.success?
      redirect_to result.user, notice: 'User created successfully.'
    else
      @user = result.user
      render :new, status: :unprocessable_entity
    end
  end

  def update
    if @user.update(user_params)
      redirect_to @user, notice: 'User updated successfully.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @user.destroy
    redirect_to users_url, notice: 'User deleted.'
  end

  private

  def set_user
    @user = User.find(params[:id])
  end

  def user_params
    params.require(:user).permit(:name, :email, :role)
  end
end

# ❌ Fat Controller (avoid)
class UsersController < ApplicationController
  def create
    @user = User.new(user_params)
    @user.generate_token
    @user.send_welcome_email
    @user.notify_admins
    @user.create_default_settings
    # Too much logic in controller
  end
end
```

### 2. Model Pattern

```ruby
# ✅ Model with proper organization
class User < ApplicationRecord
  # Constants
  ROLES = %w[admin member guest].freeze

  # Associations
  belongs_to :organization
  has_many :posts, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_one :profile, dependent: :destroy

  # Validations
  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true, length: { minimum: 2, maximum: 100 }
  validates :role, inclusion: { in: ROLES }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :admins, -> { where(role: 'admin') }
  scope :recent, -> { order(created_at: :desc) }
  scope :search, ->(query) { where('name ILIKE ? OR email ILIKE ?', "%#{query}%", "%#{query}%") }

  # Callbacks (use sparingly)
  before_validation :normalize_email
  after_create :send_welcome_email

  # Instance methods
  def full_name
    "#{first_name} #{last_name}".strip
  end

  def admin?
    role == 'admin'
  end

  private

  def normalize_email
    self.email = email.downcase.strip if email.present?
  end

  def send_welcome_email
    UserMailer.welcome(self).deliver_later
  end
end
```

### 3. Service Object Pattern

```ruby
# app/services/users/create_service.rb
module Users
  class CreateService
    include Callable

    def initialize(params, current_user: nil)
      @params = params
      @current_user = current_user
    end

    def call
      user = User.new(@params)
      user.created_by = @current_user

      if user.save
        send_notifications(user)
        Result.success(user: user)
      else
        Result.failure(user: user, errors: user.errors)
      end
    end

    private

    def send_notifications(user)
      UserMailer.welcome(user).deliver_later
      AdminNotifier.new_user(user).deliver_later
    end
  end
end

# app/services/concerns/callable.rb
module Callable
  extend ActiveSupport::Concern

  class_methods do
    def call(...)
      new(...).call
    end
  end
end

# app/services/result.rb
class Result
  attr_reader :data, :errors

  def initialize(success:, data: {}, errors: [])
    @success = success
    @data = data
    @errors = errors
  end

  def success?
    @success
  end

  def failure?
    !success?
  end

  def method_missing(method_name, *args)
    @data[method_name] || super
  end

  def self.success(data = {})
    new(success: true, data: data)
  end

  def self.failure(errors: [], **data)
    new(success: false, data: data, errors: errors)
  end
end
```

### 4. Query Object Pattern

```ruby
# app/queries/users_query.rb
class UsersQuery
  def initialize(relation = User.all)
    @relation = relation
  end

  def call(params = {})
    @relation
      .then { |r| filter_by_status(r, params[:status]) }
      .then { |r| filter_by_role(r, params[:role]) }
      .then { |r| search(r, params[:search]) }
      .then { |r| sort(r, params[:sort]) }
  end

  private

  def filter_by_status(relation, status)
    return relation if status.blank?

    case status
    when 'active' then relation.active
    when 'inactive' then relation.inactive
    else relation
    end
  end

  def filter_by_role(relation, role)
    return relation if role.blank?

    relation.where(role: role)
  end

  def search(relation, query)
    return relation if query.blank?

    relation.search(query)
  end

  def sort(relation, sort_param)
    return relation.recent if sort_param.blank?

    case sort_param
    when 'name' then relation.order(:name)
    when 'email' then relation.order(:email)
    when 'oldest' then relation.order(:created_at)
    else relation.recent
    end
  end
end

# Usage in controller
def index
  @users = UsersQuery.new.call(params).page(params[:page])
end
```

### 5. Form Object Pattern

```ruby
# app/forms/user_registration_form.rb
class UserRegistrationForm
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :name, :string
  attribute :email, :string
  attribute :password, :string
  attribute :password_confirmation, :string
  attribute :terms_accepted, :boolean

  validates :name, presence: true, length: { minimum: 2 }
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, presence: true, length: { minimum: 8 }
  validates :password_confirmation, presence: true
  validate :passwords_match
  validate :terms_must_be_accepted

  def save
    return false unless valid?

    ActiveRecord::Base.transaction do
      @user = User.create!(
        name: name,
        email: email,
        password: password
      )
      @user.create_profile!
      send_welcome_email
    end

    true
  rescue ActiveRecord::RecordInvalid => e
    errors.add(:base, e.message)
    false
  end

  def user
    @user
  end

  private

  def passwords_match
    return if password == password_confirmation

    errors.add(:password_confirmation, "doesn't match password")
  end

  def terms_must_be_accepted
    return if terms_accepted

    errors.add(:terms_accepted, 'must be accepted')
  end

  def send_welcome_email
    UserMailer.welcome(@user).deliver_later
  end
end
```

### 6. API Controllers

```ruby
# app/controllers/api/v1/base_controller.rb
module Api
  module V1
    class BaseController < ApplicationController
      skip_before_action :verify_authenticity_token
      before_action :authenticate_api_user!

      rescue_from ActiveRecord::RecordNotFound, with: :not_found
      rescue_from ActionController::ParameterMissing, with: :bad_request

      private

      def authenticate_api_user!
        token = request.headers['Authorization']&.split(' ')&.last
        @current_user = User.find_by(api_token: token)

        render_unauthorized unless @current_user
      end

      def render_success(data, status: :ok)
        render json: { success: true, data: data }, status: status
      end

      def render_error(message, status: :unprocessable_entity)
        render json: { success: false, error: message }, status: status
      end

      def render_unauthorized
        render json: { error: 'Unauthorized' }, status: :unauthorized
      end

      def not_found
        render json: { error: 'Not found' }, status: :not_found
      end

      def bad_request(exception)
        render json: { error: exception.message }, status: :bad_request
      end
    end
  end
end

# app/controllers/api/v1/users_controller.rb
module Api
  module V1
    class UsersController < BaseController
      def index
        users = UsersQuery.new.call(params)
        render_success(users.map { |u| UserSerializer.new(u).as_json })
      end

      def show
        user = User.find(params[:id])
        render_success(UserSerializer.new(user).as_json)
      end

      def create
        result = Users::CreateService.call(user_params)

        if result.success?
          render_success(UserSerializer.new(result.user).as_json, status: :created)
        else
          render_error(result.errors.full_messages)
        end
      end

      private

      def user_params
        params.require(:user).permit(:name, :email, :role)
      end
    end
  end
end
```

### 7. Background Jobs

```ruby
# app/jobs/user_notification_job.rb
class UserNotificationJob < ApplicationJob
  queue_as :default
  retry_on StandardError, wait: :exponentially_longer, attempts: 3

  def perform(user_id, notification_type)
    user = User.find(user_id)

    case notification_type
    when 'welcome'
      UserMailer.welcome(user).deliver_now
    when 'reminder'
      UserMailer.reminder(user).deliver_now
    end
  rescue ActiveRecord::RecordNotFound
    # User was deleted, skip
    Rails.logger.warn("User #{user_id} not found for notification")
  end
end
```

## Project Structure

```
app/
├── controllers/
│   ├── api/
│   │   └── v1/
│   ├── concerns/
│   └── application_controller.rb
├── models/
│   └── concerns/
├── services/
│   ├── concerns/
│   │   └── callable.rb
│   └── users/
│       └── create_service.rb
├── queries/
│   └── users_query.rb
├── forms/
│   └── user_registration_form.rb
├── serializers/
│   └── user_serializer.rb
├── jobs/
├── mailers/
└── views/
```

## Checklist

- [ ] Thin controllers, fat models (but not too fat)
- [ ] Use Service Objects for complex operations
- [ ] Use Query Objects for complex queries
- [ ] Use Form Objects for complex forms
- [ ] Use Strong Parameters
- [ ] Add proper validations
- [ ] Use scopes for reusable queries
- [ ] Background jobs for slow operations
- [ ] Proper error handling and logging
- [ ] N+1 query prevention (includes, preload)
