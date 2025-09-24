import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin?: string;
}

const getRoleBadgeVariant = (role: string) => {
  if (role === "Super Admin") return "destructive";
  if (role === "Counselor") return "secondary";
  return "outline";
};

const getStatusBadgeVariant = (status: string) => {
  if (status === "Active") return "secondary";
  return "outline";
};

const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      // Only fetch students from public.users
      const { data, error } = await supabase
        .from("users")
        .select("id, name, email, role, status, last_login")
        .eq("role", "Student");
      if (error) {
        console.error("Error fetching users:", error.message);
        setUsers([]);
      } else {
        setUsers(
          (data || []).map((u: Record<string, unknown>) => ({
            id: String(u.id),
            name: String(u.name),
            email: String(u.email),
            role: "Student",
            status: String(u.status || "Active"),
            lastLogin: String(u.last_login || ""),
          }))
        );
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <CardTitle>User Directory</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Manage all users, roles, and permissions.</p>
        </div>
        {/* Add New User button can be wired to a modal for adding students if needed */}
        <Button className="w-full md:w-auto" disabled>
          <UserPlus className="h-4 w-4 mr-2" />
          Add New User
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-muted-foreground">No student users found.</p>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1">{user.id}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Edit</Button>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant={getRoleBadgeVariant(user.role) as "outline" | "secondary" | "destructive"}>{user.role}</Badge>
                  <Badge variant={getStatusBadgeVariant(user.status) as "secondary" | "outline"}>{user.status}</Badge>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading users...</TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No student users found.</TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role) as "outline" | "secondary" | "destructive"}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(user.status) as "secondary" | "outline"}>{user.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminUserManagement;
