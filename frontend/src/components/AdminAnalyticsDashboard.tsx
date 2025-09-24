
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Calendar, Siren, ThumbsUp, Reply } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const initialStats = [
  {
    title: "Total Posts",
    value: "-",
    icon: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Total Likes",
    value: "-",
    icon: <ThumbsUp className="h-4 w-4 text-muted-foreground" />,
  },
  {
    title: "Total Replies",
    value: "-",
    icon: <Reply className="h-4 w-4 text-muted-foreground" />,
  },
];


const AdminAnalyticsDashboard = () => {
  const [stats, setStats] = useState(initialStats);
  useEffect(() => {
    const fetchStats = async () => {
      // Total posts
      const { count: postCount } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true });

      // Total likes (sum likes_count from posts)

      const { data: posts } = await supabase
        .from("posts")
        .select("likes_count, replies_count");
      const totalLikes = posts ? posts.reduce((sum, p) => sum + (p.likes_count || 0), 0) : 0;
      const totalReplies = posts ? posts.reduce((sum, p) => sum + (p.replies_count || 0), 0) : 0;

      setStats([
        {
          title: "Total Posts",
          value: postCount?.toString() ?? "-",
          icon: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
        },
        {
          title: "Total Likes",
          value: totalLikes.toString(),
          icon: <ThumbsUp className="h-4 w-4 text-muted-foreground" />,
        },
        {
          title: "Total Replies",
          value: totalReplies.toString(),
          icon: <Reply className="h-4 w-4 text-muted-foreground" />,
        },
      ]);
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Analytics Dashboard
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          An overview of platform engagement and user activity.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminAnalyticsDashboard;
