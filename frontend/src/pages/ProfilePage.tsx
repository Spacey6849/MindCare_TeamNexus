import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const ProfilePage = () => {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-24">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Full Name</p>
            <p className="font-medium">{user.fullName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Role</p>
            <p className="font-medium uppercase">{user.role}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline">Edit Profile</Button>
            <Button variant="secondary" disabled>Reset Password (coming soon)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
