# Favorite List Backend Module - Implementation Plan

## Overview

Implement a complete backend module for managing user's custom problem lists (favorite lists), including CRUD operations, problem management, and public/private list sharing.

## Database Schema

### FavoriteList Entity

```typescript
@Entity('favorite_lists')
export class FavoriteList {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 10, default: '📝' })
  icon: string;

  @Column({ name: 'is_public', default: false })
  isPublic: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToMany(() => Problem)
  @JoinTable({
    name: 'favorite_list_problems',
    joinColumn: { name: 'list_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'problem_id', referencedColumnName: 'id' },
  })
  problems: Problem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### Junction Table

- `favorite_list_problems`: Many-to-many relationship between lists and problems

## API Endpoints

### List Management

#### GET /favorite-lists

Get all lists for current user

- **Auth**: Required
- **Response**: Array of FavoriteList with problem count

#### GET /favorite-lists/:id

Get single list with all problems

- **Auth**: Required (owner) or Public list
- **Response**: FavoriteList with full problem details

#### POST /favorite-lists

Create new list

- **Auth**: Required
- **Body**: CreateFavoriteListDto
- **Response**: Created FavoriteList

#### PATCH /favorite-lists/:id

Update list metadata (name, icon, isPublic)

- **Auth**: Required (owner only)
- **Body**: UpdateFavoriteListDto
- **Response**: Updated FavoriteList

#### DELETE /favorite-lists/:id

Delete list

- **Auth**: Required (owner only)
- **Validation**: Cannot delete default list
- **Response**: Success message

---

### Problem Management

#### POST /favorite-lists/:id/problems/:problemId

Add problem to list

- **Auth**: Required (owner only)
- **Response**: Updated FavoriteList

#### DELETE /favorite-lists/:id/problems/:problemId

Remove problem from list

- **Auth**: Required (owner only)
- **Response**: Updated FavoriteList

#### GET /favorite-lists/:id/problems

Get all problems in a list with pagination

- **Auth**: Required (owner) or Public list
- **Query**: page, limit, sortBy, sortOrder
- **Response**: Paginated problems

---

### Public Lists

#### GET /favorite-lists/public

Get all public lists (discovery)

- **Auth**: Optional
- **Query**: page, limit, search
- **Response**: Paginated public lists

#### GET /favorite-lists/user/:userId/public

Get public lists for specific user

- **Auth**: Optional
- **Response**: Array of public lists

## DTOs

### CreateFavoriteListDto

```typescript
{
  name: string;          // required, max 255
  icon?: string;         // optional, default '📝', max 10
  isPublic?: boolean;    // optional, default false
}
```

### UpdateFavoriteListDto

```typescript
{
  name?: string;         // optional, max 255
  icon?: string;         // optional, max 10
  isPublic?: boolean;    // optional
}
```

### AddProblemDto

```typescript
{
  problemId: number; // required
}
```

## Service Methods

### FavoriteListService

- `create(userId: number, dto: CreateFavoriteListDto): Promise<FavoriteList>`
- `findAllByUser(userId: number): Promise<FavoriteList[]>`
- `findOne(id: number, userId?: number): Promise<FavoriteList>`
- `update(id: number, userId: number, dto: UpdateFavoriteListDto): Promise<FavoriteList>`
- `remove(id: number, userId: number): Promise<void>`
- `addProblem(listId: number, problemId: number, userId: number): Promise<FavoriteList>`
- `removeProblem(listId: number, problemId: number, userId: number): Promise<FavoriteList>`
- `getProblems(listId: number, userId: number, query: PaginationDto): Promise<PaginatedResponse<Problem>>`
- `findPublicLists(query: PaginationDto): Promise<PaginatedResponse<FavoriteList>>`
- `findUserPublicLists(userId: number): Promise<FavoriteList[]>`

## Guards & Validation

- **JwtAuthGuard**: Protect all authenticated endpoints
- **ListOwnerGuard**: Ensure user owns the list for modifications
- **PublicListGuard**: Allow access to public lists for non-owners

## Module Dependencies

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([FavoriteList, Problem]),
  ],
  controllers: [FavoriteListController],
  providers: [FavoriteListService],
  exports: [FavoriteListService],
})
```

## Implementation Steps

1. ✅ Create module structure (already done)
2. Complete FavoriteList entity with all relationships
3. Implement CreateFavoriteListDto with validation
4. Implement UpdateFavoriteListDto with validation
5. Implement FavoriteListService with all CRUD methods
6. Implement FavoriteListController with all endpoints
7. Add guards for authorization
8. Add Swagger documentation
9. Write unit tests for service
10. Write e2e tests for controller
11. Update app.module.ts to import FavoriteListModule
12. Create database migration

## Testing Checklist

- [ ] Create list
- [ ] Get user's lists
- [ ] Update list metadata
- [ ] Delete list (verify default list protection)
- [ ] Add problem to list
- [ ] Remove problem from list
- [ ] Get problems in list with pagination
- [ ] Access public list as non-owner
- [ ] Prevent access to private list as non-owner
- [ ] Get all public lists
- [ ] Get user's public lists

## Notes

- Default "Favorite" list should be created automatically for new users (consider user creation hook)
- Ensure proper cascading deletes for list-problem relationships
- Add indexes on user_id and is_public for query performance
- Consider rate limiting for list creation
