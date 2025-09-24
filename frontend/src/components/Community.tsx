import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Users, Clock, Pin, ThumbsUp, Reply, MoreHorizontal, HelpingHand, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";


// Enhanced: Define a type for our Post for better state management
interface ForumPost {
  id: string;
  title: string;
  author: string;
  category: string;
  timeAgo: string;
  replies: number;
  likes: number;
  isPinned: boolean;
  preview: string;
  tags: string[];
}

// Supabase types
interface SupabaseUserRef {
  full_name?: string | null;
  email?: string | null;
}

interface SupabasePostRow {
  id: string;
  title: string;
  category: string;
  preview: string;
  tags: string[] | null;
  likes_count: number | null;
  replies_count: number | null;
  created_at: string;
  is_pinned?: boolean | null;
  user_id?: string | null;
  users?: SupabaseUserRef | SupabaseUserRef[] | null;
}

const Community = () => {
  // Consume user from global AuthContext to avoid duped state
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id ?? null;
  const [showNewPost, setShowNewPost] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Enhanced: State for active reply sections and their content
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // Show replies for a post
  const [replies, setReplies] = useState<Record<string, string[]>>({});

  const forumStats = [
    { label: "Active Members", value: "2,847", icon: Users },
    { label: "Support Posts", value: "1,234", icon: MessageSquare },
    { label: "Peer Helpers", value: "89", icon: HelpingHand },
    { label: "Response Time", value: "< 2hr", icon: Clock },
  ];

  // Enhanced: Expanded list of posts for a more dynamic "Load More" experience
  const [allForumPosts, setAllForumPosts] = useState<ForumPost[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState(3);

  // New Post Form
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("");
  const [newPostTags, setNewPostTags] = useState<string[]>([]);
  const [creatingPost, setCreatingPost] = useState(false);

  // Resolve or create a Supabase users.id for the current app user
  const resolveSupabaseUserId = async (): Promise<string | null> => {
    // 1) Supabase auth session (if using Supabase Auth elsewhere)
    const { data: { session } } = await supabase.auth.getSession();
    const sid = session?.user?.id ?? null;
    if (sid) return sid;

    // 2) Cached mapping
    try {
      const cached = localStorage.getItem('auth:supabaseUserId');
      if (cached) return cached;
    } catch (e) {
      console.warn('Community: failed to read cached supabase user id', e);
    }

    // 3) Lookup by email in public.users
    if (user?.email) {
      const { data: rows, error } = await supabase
        .from('users')
        .select('id')
        .ilike('email', user.email);
      if (!error && rows && rows.length > 0) {
        const found = String(rows[0].id);
        try { localStorage.setItem('auth:supabaseUserId', found); } catch (e) { console.warn('Community: cache supabase user id failed', e); }
        return found;
      }
      // 4) Upsert a new users row and return its id (schema requires id uuid; generate in client) using email as unique key
      try {
        const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
        const { data: upserted, error: upErr } = await supabase
          .from('users')
          .upsert({ id: newId, email: user.email, full_name: user.fullName || 'Student' })
          .select('id')
          .single();
        if (upErr) {
          console.error('Community: failed to upsert users row', upErr);
        }
        if (upserted?.id) {
          const nid = String(upserted.id);
          try { localStorage.setItem('auth:supabaseUserId', nid); } catch (e) { console.warn('Community: cache new supabase user id failed', e); }
          return nid;
        }
      } catch (e) {
        console.error('Community: exception upserting users row', e);
      }
    }
    return null;
  };

  useEffect(() => {
    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("id, title, category, preview, tags, likes_count, replies_count, created_at, user_id, users(full_name, email)")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching posts:", error.message);
        setAllForumPosts([]);
      } else {
        const rows: SupabasePostRow[] = (data as unknown as SupabasePostRow[]) || [];
        setAllForumPosts(
          rows.map((p) => {
            const u = Array.isArray(p.users) ? p.users[0] : p.users;
            const authorName = u?.full_name || (u?.email ? u.email.split('@')[0] : 'Student');
            return {
              id: String(p.id),
              title: p.title,
              author: authorName,
              category: p.category,
              timeAgo: "", // TODO: format from created_at
              replies: p.replies_count ?? 0,
              likes: p.likes_count ?? 0,
              isPinned: p.is_pinned ?? false,
              preview: p.preview,
              tags: p.tags || [],
            };
          })
        );
      }
    };
    fetchPosts();
  }, []);

  const forumPosts = allForumPosts.slice(0, displayedPosts);

  // FIX: Implemented handleLoadMore to add more posts
  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      const newDisplayCount = displayedPosts + 3;
      setDisplayedPosts(Math.min(newDisplayCount, allForumPosts.length));
      setLoadingMore(false);
      if (newDisplayCount >= allForumPosts.length) {
        toast.success("All discussions loaded!");
      } else {
        toast.success("Loaded more discussions.");
      }
    }, 1000); // Simulate network delay
  };
  
  // Like a post
  const handleLike = async (postId: string) => {
    const effectiveUserId = await resolveSupabaseUserId();
    if (!effectiveUserId) {
      toast.error("You must be logged in to like.");
      return;
    }
    // optimistic UI update
    setAllForumPosts(allForumPosts.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
  const post = allForumPosts.find(p => p.id === postId);
    try {
      // record like (unique per user/post)
      const { error: likeErr } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: effectiveUserId });
      // If unique violation (user already liked), ignore; otherwise propagate
      if (likeErr && (likeErr as { code?: string }).code !== '23505') {
        throw likeErr;
      }
      // bump counter
      await supabase.from("posts").update({ likes_count: (post?.likes ?? 0) + 1 }).eq("id", postId);
    } catch (e) {
      // rollback UI on failure
      setAllForumPosts(allForumPosts.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
      toast.error("Failed to like post");
    }
  };

  // Reply to a post
  const handleReplySubmit = async (postId: string) => {
    if (!replyContent.trim()) {
      toast.error("Reply cannot be empty.");
      return;
    }
    const effectiveUserId = await resolveSupabaseUserId();
    if (!effectiveUserId) {
      toast.error("You must be logged in to reply.");
      return;
    }
    // Store reply in Supabase
    await supabase.from("post_replies").insert({ post_id: postId, user_id: effectiveUserId, content: replyContent, is_anonymous: true });
    // Update reply count in posts table
    const post = allForumPosts.find(p => p.id === postId);
    if (post) {
      await supabase.from("posts").update({ replies_count: post.replies + 1 }).eq("id", postId);
      setAllForumPosts(allForumPosts.map(p => p.id === postId ? { ...p, replies: p.replies + 1 } : p));
    }
    toast.success("Your reply has been posted!");
  setActiveReply(null);
    setReplyContent("");
  };

  // Toggle replies visibility and fetch replies from Supabase
  const handleShowReplies = async (postId: string) => {
    if (replies[postId]) {
      // Toggle off: remove key cleanly
      setReplies((prev) => {
        const next = { ...prev } as Record<string, string[]>;
        delete next[postId];
        return next;
      });
      return;
    }
    const { data, error } = await supabase
      .from("post_replies")
      .select("content")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Failed to load replies");
      return;
    }
    setReplies((prev) => ({ ...prev, [postId]: (data || []).map((r: { content: string }) => r.content) }));
  };

  const handleCreatePost = async () => {
    if (creatingPost) return;
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast.error("Title and content required.");
      return;
    }
    // Resolve a stable Supabase users.id UUID
    const effectiveUserId = await resolveSupabaseUserId();
    if (!effectiveUserId) {
      toast.error("You must be logged in to post.");
      return;
    }
    setCreatingPost(true);
    const { data: created, error: createErr } = await supabase
      .from("posts")
      .insert({
        user_id: effectiveUserId,
        title: newPostTitle,
        content: newPostContent,
        preview: newPostContent.slice(0, 100),
        category: newPostCategory || "General",
        tags: newPostTags,
        is_pinned: false,
        likes_count: 0,
        replies_count: 0
      })
      .select('id')
      .single();
    if (createErr) {
      console.error('Create post failed:', createErr);
      const msg = (createErr as { message?: string }).message || 'Failed to create post';
      toast.error(msg.includes('duplicate') || msg.includes('conflict') ? 'A similar post already exists.' : 'Failed to create post.');
      setCreatingPost(false);
      return;
    }
    // Success
    setShowNewPost(false);
    setNewPostTitle("");
    setNewPostContent("");
    setNewPostCategory("");
    setNewPostTags([]);
    toast.success("Post created!");
    // Refresh posts
    const { data } = await supabase
      .from("posts")
      .select("id, title, category, preview, tags, likes_count, replies_count, created_at, user_id, users(full_name, email)")
      .order("created_at", { ascending: false });
    const rows2: SupabasePostRow[] = (data as unknown as SupabasePostRow[]) || [];
    setAllForumPosts(
      rows2.map((p) => {
        const u = Array.isArray(p.users) ? p.users[0] : p.users;
        const authorName = u?.full_name || (u?.email ? u.email.split('@')[0] : 'Student');
        return {
          id: p.id,
          title: p.title,
          author: authorName,
          category: p.category,
          timeAgo: "",
          replies: p.replies_count ?? 0,
          likes: p.likes_count ?? 0,
          isPinned: p.is_pinned ?? false,
          preview: p.preview,
          tags: p.tags || [],
        };
      })
    );
    setCreatingPost(false);
  };

  const categoryColors = {
    "Academic Stress": "primary",
    "Social Connection": "secondary",
    "Sleep & Wellness": "accent",
    "Success Stories": "success",
    "Mental Health Support": "warning",
  };

  return (
    <section id="community" className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-success/10 text-success border-success/20">
              🤝 Peer Support Community
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Connect with Fellow Students
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Join our moderated peer support forum where students share experiences, 
              offer support, and connect with trained student volunteers in a safe space.
            </p>
          </div>

          {/* Community Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {forumStats.map((stat, index) => (
              <Card key={index} className="text-center border-border/50">
                <CardContent className="p-6">
                  <stat.icon className={`h-8 w-8 text-primary mx-auto mb-2`} />
                  <div className="text-2xl font-bold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Forum Posts */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">Recent Discussions</h3>
                <Button 
                  onClick={() => setShowNewPost(!showNewPost)}
                  className="bg-gradient-wellness hover:opacity-90"
                >
                  {showNewPost ? 'Cancel' : 'Start New Discussion'}
                </Button>
              </div>

              {/* New Post Form */}
              {showNewPost && (
                <Card className="mb-6 shadow-soft border-border/50">
                  <CardHeader>
                    <CardTitle>Create a New Post</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input placeholder="Post Title" value={newPostTitle} onChange={e => setNewPostTitle(e.target.value)} />
                    <Textarea placeholder="Share your thoughts... (Remember to be respectful and avoid sharing personal information)" rows={4} value={newPostContent} onChange={e => setNewPostContent(e.target.value)} />
                    <Input placeholder="Category (optional)" value={newPostCategory} onChange={e => setNewPostCategory(e.target.value)} />
                    <Input placeholder="Tags (comma separated, optional)" value={newPostTags.join(", ")} onChange={e => setNewPostTags(e.target.value.split(",").map(t => t.trim()))} />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowNewPost(false)}>Cancel</Button>
                      <Button onClick={handleCreatePost}>Post</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {forumPosts.map((post) => (
                  <Card key={post.id} className="shadow-soft border-border/50 hover:shadow-medium transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {post.isPinned && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              categoryColors[post.category as keyof typeof categoryColors] === 'primary' ? 'border-primary/30 text-primary' :
                              categoryColors[post.category as keyof typeof categoryColors] === 'secondary' ? 'border-secondary/30 text-secondary' :
                              categoryColors[post.category as keyof typeof categoryColors] === 'accent' ? 'border-accent/30 text-accent' :
                              'border-success/30 text-success'
                            }`}
                          >
                            {post.category}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>

                      <Link to={`/community/post/${post.id}`}>
                        <h4 className="font-semibold text-lg mb-2 hover:text-primary cursor-pointer transition-colors">
                          {post.title}
                        </h4>
                      </Link>

                      <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
                        {post.preview}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs bg-primary/10">
                                {post.author.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{post.author}</span>
                          </div>
                          <span>•</span>
                          <span>{post.timeAgo}</span>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleLike(post.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {post.likes}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleShowReplies(post.id)}
                          >
                            <Reply className="h-4 w-4 mr-1" />
                            {post.replies}
                          </Button>
                        </div>
                      </div>
                      
                      {/* FIX: Reply input section, appears when reply button is clicked */}
                      {activeReply === post.id && (
                        <div className="mt-4 pt-4 border-t border-border/50">
                           <div className="flex items-center space-x-3">
                                <Input 
                                    type="text"
                                    placeholder="Write a reply..."
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                />
                                <Button size="icon" onClick={() => handleReplySubmit(post.id)}>
                                    <Send className="h-4 w-4"/>
                                </Button>
                           </div>
                        </div>
                      )}

                      {/* Replies section */}
                      {replies[post.id] && (
                        <div className="mt-2 pl-4 border-l border-border/30">
                          {replies[post.id].length === 0 ? (
                            <span className="text-xs text-muted-foreground">No replies yet.</span>
                          ) : (
                            replies[post.id].map((reply, idx) => (
                              <div key={idx} className="mb-2 text-sm text-muted-foreground">{reply}</div>
                            ))
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {displayedPosts < allForumPosts.length && (
                <div className="text-center mt-8">
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load More Discussions"}
                  </Button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Guidelines */}
              <Card className="shadow-soft border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Community Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start space-x-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2"></div>
                    <span>Be respectful and kind to fellow students</span>
                  </div>
                  <div className="flex items-start space-x-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2"></div>
                    <span>Share experiences, not personal details</span>
                  </div>
                  <div className="flex items-start space-x-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2"></div>
                    <span>No medical advice - seek professional help</span>
                  </div>
                  <div className="flex items-start space-x-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2"></div>
                    <span>Report harmful content immediately</span>
                  </div>
                </CardContent>
              </Card>

              {/* Peer Helpers */}
              <Card className="shadow-soft border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Trained Peer Helpers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Our community is supported by trained student volunteers who provide additional guidance and support.
                  </p>
                  <div className="flex items-center space-x-2 mb-3">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <span className="text-sm font-medium">12 helpers online now</span>
                  </div>
                  <Link to="/peer-helper-application" className="w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      Become a Peer Helper
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Crisis Resources */}
              <Card className="bg-destructive/5 border-destructive/20 shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive">Need Immediate Help?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    If you're in crisis, don't wait for community responses.
                  </p>
                  <div className="space-y-2">
                    <a href="tel:1800-599-0019" className="w-full">
                      <Button variant="destructive" size="sm" className="w-full">
                        Crisis Hotline: 1800-599-0019
                      </Button>
                    </a>
                    <Link to="/booking" className="w-full">
                        <Button variant="outline" size="sm" className="w-full">
                            Campus Counseling
                        </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Community;
