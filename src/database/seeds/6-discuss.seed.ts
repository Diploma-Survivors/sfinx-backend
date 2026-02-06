import { DataSource } from 'typeorm';
import { Post } from '../../modules/discuss/entities/post.entity';
import { DiscussTag } from '../../modules/discuss/entities/discuss-tag.entity';
import { PostComment } from '../../modules/discuss/entities/post-comment.entity';
import { User } from '../../modules/auth/entities/user.entity';
import slugify from 'slugify';

export async function seedDiscuss(dataSource: DataSource) {
  console.log('🌱 Seeding Discuss module...');

  const postRepository = dataSource.getRepository(Post);
  const tagRepository = dataSource.getRepository(DiscussTag);
  const commentRepository = dataSource.getRepository(PostComment);
  const userRepository = dataSource.getRepository(User);

  // 1. Get a real user to be the author
  const author = await userRepository.findOne({
    where: {}, // Get any user, ideally an admin or the first user
    order: { createdAt: 'ASC' },
  });

  if (!author) {
    console.warn(
      '⚠️ No user found. Skipping Discuss seeding. Please ensure users exist.',
    );
    return;
  }

  console.log(`👤 Using user ${author.email} (ID: ${author.id}) as author`);

  // 2. Seed DiscussTags
  const tagNames = [
    { name: 'Interview', color: '#FF9F43', slug: 'interview' },
    { name: 'Compensation', color: '#28C76F', slug: 'compensation' },
    { name: 'Career', color: '#EA5455', slug: 'career' },
    { name: 'Contest', color: '#00CFE8', slug: 'contest' },
    { name: 'Feedback', color: '#7367F0', slug: 'feedback' },
    { name: 'System Design', color: '#A8A8A8', slug: 'system-design' },
  ];

  const savedTags: DiscussTag[] = [];

  for (const tagData of tagNames) {
    const existingTag = await tagRepository.findOne({
      where: { slug: tagData.slug },
    });
    if (!existingTag) {
      const newTag = tagRepository.create(tagData);
      savedTags.push(await tagRepository.save(newTag));
    } else {
      savedTags.push(existingTag);
    }
  }

  // Helper to find tags safely
  const findTags = (slugs: string[]) => {
    return savedTags.filter((t) => slugs.includes(t.slug));
  };

  // 3. Seed Posts
  const postsData = [
    {
      title: 'Google L3 Interview Experience (Offer Accepted)',
      content: `## Background
I finally cracked the Google interview for L3 (Software Engineer II) position. Here is my experience.

## Preparation
I prepared for about 3 months, mainly focusing on LeetCode patterns and System Design basics.

### Resources
- Cracking the Coding Interview
- Sfinx Platform (of course!)

## The Interview
1. **Phone Screen**: 1 LeetCode Medium (Graph). Solved it optimally.
2. **Onsite 1**: DP Problem. A bit tricky but managed to solve it.
3. **Onsite 2**: Tree traversal. Standard BFS approach.
4. **Onsite 3**: Googleyness & Leadership.
5. **Onsite 4**: System Design (Design a URL shortener).

## Result
Offer received after 1 week!`,
      tagSlugs: ['interview', 'career'],
      viewCount: 1250,
      upvoteCount: 45,
    },
    {
      title: 'Dynamic Programming Patterns for Beginners',
      content: `Dynamic Programming (DP) is often considered one of the hardest topics. However, most DP problems fall into a few categories.

### 1. 0/1 Knapsack
This is the classic pattern...

### 2. Unbounded Knapsack
Similar to above but...

### 3. Longest Common Subsequence
Used in string comparison problems...

Keep practicing!`,
      tagSlugs: ['contest', 'interview'],
      viewCount: 890,
      upvoteCount: 120,
    },
    {
      title: 'Salary Negotiation Tips 2024',
      content: `Always negotiate! Even if it's just a sign-on bonus.
      
1. Do your market research.
2. Don't reveal your current salary.
3. Be polite but firm.`,
      tagSlugs: ['compensation', 'career'],
      viewCount: 3400,
      upvoteCount: 200,
    },
  ];

  const savedPosts: Post[] = [];

  for (const postData of postsData) {
    // Generate valid slug
    const slug = slugify(postData.title, { lower: true, strict: true });

    // Check if post exists
    const existingPost = await postRepository.findOne({ where: { slug } });

    if (!existingPost) {
      const newPost = new Post();
      newPost.title = postData.title;
      newPost.content = postData.content;
      newPost.slug = slug;
      newPost.viewCount = postData.viewCount;
      newPost.upvoteCount = postData.upvoteCount;
      newPost.author = author;
      newPost.tags = findTags(postData.tagSlugs);

      savedPosts.push(await postRepository.save(newPost));
    } else {
      savedPosts.push(existingPost);
    }
  }

  // 4. Seed Comments
  if (savedPosts.length > 0) {
    const commentsData = [
      {
        content: 'Congratulations! This is very inspiring.',
        postId: savedPosts[0].id,
        authorId: author.id,
      },
      {
        content: 'Could you share strictly what graph problem it was?',
        postId: savedPosts[0].id,
        authorId: author.id,
      },
      {
        content: 'Great guide on DP. Thanks for sharing.',
        postId: savedPosts[1].id,
        authorId: author.id,
      },
    ];

    for (const commentData of commentsData) {
      const newComment = new PostComment();
      newComment.content = commentData.content;
      newComment.postId = commentData.postId;
      newComment.authorId = commentData.authorId;

      await commentRepository.save(newComment);
    }
  }

  console.log('✅ Discuss module seeding completed.');
}
