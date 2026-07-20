# Agent Guidelines for Runner (Postman Clone)

## Project Overview

Runner is an API development platform with three workspaces:
- **Web** (`apps/web`): Next.js 14 frontend with React 18, Tailwind CSS, Zustand state management
- **API** (`apps/api`): Express.js backend with TypeScript
- **Shared** (`packages/shared`): Shared types and utilities

**Node.js 18+ required. npm 9+ required.**

---

## Build/Lint/Test Commands

### Running the Application

Execute start.sh

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run single test file (web)
npm test -- --testPathPattern="workspaceStore.test.ts"

# Run single test file (api)
cd apps/api && npm test -- --testPathPattern="auth.test.ts"
```

### Linting & Building

```bash
# Lint all workspaces
npm run lint

# Build all workspaces
npm run build

# Build individual workspaces
npm run build:web
npm run build:api
npm run build:shared

# Clean node_modules
npm run clean
```

### Type Checking

```bash
# Use TypeScript compiler directly (no npm script)
npx tsc --noEmit
```

---

## Code Style Guidelines

### TypeScript Conventions

- Use explicit types for function parameters and return values
- Use TypeScript types from `@apiforge/shared` for domain models
- Prefer `interface` for object shapes, `type` for unions/aliases
- Use `unknown` instead of `any` when type is uncertain, then narrow with type guards

```typescript
// Good
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)

// Bad
interface Props { onClick: any; data: any; }
```

### React/Next.js Conventions

- Client components MUST have `'use client'` directive at the top
- Use functional components with hooks, not class components
- Name components PascalCase: `RequestBuilder.tsx`, `Sidebar.tsx`
- Co-locate tests: `Component.tsx` → `__tests__/Component.test.tsx`

### File Organization

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/              # Authenticated routes
│   └── (auth)/             # Authentication routes
├── components/
│   ├── ui/                 # Generic UI (Button, Modal, Input, etc.)
│   ├── layout/             # Layout components (TopBar, Sidebar, etc.)
│   ├── request/            # Request builder components
│   ├── response/           # Response viewer components
│   └── collection/         # Collection panel components
├── stores/                 # Zustand stores
│   └── __tests__/          # Store tests
├── lib/                    # Utilities, API client, sync manager
└── hooks/                  # Custom React hooks
```

### Import Order

1. External dependencies (React, Next.js, Lucide icons)
2. Internal packages (`@apiforge/shared`)
3. Internal modules (`@/stores/`, `@/components/`, `@/lib/`)
4. Type imports

```typescript
// Example imports
'use client';

import React, { useState, useEffect } from 'react';
import { Send, Code, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { ApiRequest, HttpMethod } from '@apiforge/shared';
import { useCollectionsStore } from '@/stores/collectionsStore';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `RequestBuilder`, `Sidebar` |
| Files | PascalCase | `RequestBuilder.tsx`, `SyncStatus.tsx` |
| Functions | camelCase | `handleSelectRequest`, `getInterpolatedValue` |
| Hooks | camelCase with use prefix | `useCollectionsStore`, `useDebounce` |
| Types/Interfaces | PascalCase | `ApiRequest`, `RequestBuilderProps` |
| Constants | SCREAMING_SNAKE | `HTTP_METHODS`, `AUTH_TYPES` |
| CSS classes | kebab-case (Tailwind) | `bg-[#ff6b35]`, `text-gray-300` |
| CSS modules | camelCase | `containerStyles`, `buttonDisabled` |

### Zustand Store Patterns

```typescript
// Store definition pattern
interface StoreState {
  items: Item[];
  currentItem: Item | null;
  addItem: (item: Item) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  removeItem: (id: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: [],
      currentItem: null,
      
      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),
      
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map((item) =>
          item._id === id ? { ...item, ...updates } : item
        )
      })),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item._id !== id)
      })),
    }),
    { name: 'store-key' }
  )
);
```

### Error Handling

```typescript
// API errors - use try/catch with async/await
async function fetchData() {
  try {
    const response = await apiClient.get<MyType>('/api/endpoint');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Unknown error');
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error; // Re-throw for caller to handle
  }
}

// UI error states
const [error, setError] = useState<string | null>(null);

// Use error boundaries for component tree failures
// Use try/catch for async operations
// Return error state for recoverable failures
```

### Zustand Selectors

```typescript
// Selector patterns for performance
const { items, loading } = useStore(); // Select multiple
const item = useStore((s) => s.items.find(i => i._id === id)); // Memoized
const count = useStore((s) => s.items.length); // Derived value
```

### CSS/Tailwind Guidelines

- Use design tokens: primary color `#ff6b35`, background `#1e1e1e`, surfaces `#2d2d2d`
- Use `cn()` utility for conditional classes
- Avoid hardcoded colors in JSX; use CSS variables or theme
- Keep responsive classes in component files, not inline styles

```typescript
import { cn } from '@/lib/utils';

// Pattern
<button className={cn(
  'base-classes',
  { 'conditional-class': isActive },
  className // Allow override
)} />
```

---

## Testing Patterns

### Jest + React Testing Library

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

// Mock external dependencies
jest.mock('@/lib/api', () => ({
  apiClient: { get: jest.fn() }
}));

describe('Button Component', () => {
  it('renders with correct variant', () => {
    render(<Button variant="primary">Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Zustand Store Testing

```typescript
beforeEach(() => {
  useStore.setState({ items: [], currentItem: null });
});

it('should add item', () => {
  useStore.getState().addItem({ _id: '1', name: 'Test' });
  expect(useStore.getState().items).toHaveLength(1);
});
```

---

## Common Patterns

### Breadcrumb Component Pattern

```typescript
<div className="flex items-center gap-1 text-sm text-gray-400">
  <span className="hover:text-[#ff6b35] cursor-pointer">Collections</span>
  <ChevronRight className="w-4 h-4" />
  <span className="hover:text-[#ff6b35] cursor-pointer">{collectionName}</span>
  <ChevronRight className="w-4 h-4" />
  <span className="text-gray-200">{currentItem}</span>
</div>
```

### Dropdown Pattern

```typescript
<Dropdown
  trigger={
    <Button variant="secondary">
      Actions
    </Button>
  }
  items={[
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete' },
  ]}
/>
```

### Modal Pattern

```typescript
<Modal isOpen={isOpen} onClose={onClose} title="Title">
  <div>Content</div>
</Modal>
```
