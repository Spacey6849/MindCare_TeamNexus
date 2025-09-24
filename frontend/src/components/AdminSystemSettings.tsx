import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bot, BookOpen, Users, MessageSquare, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Counselor {
  id: string;
  name: string;
  contact_email: string;
  is_available: boolean;
  specialization?: string;
  experience_years?: number;
  bio?: string;
  available_slots?: object;
}

const AdminSystemSettings = () => {
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(false);
  const [newCounselor, setNewCounselor] = useState({ name: "", email: "" });

  useEffect(() => {
    const fetchCounselors = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("counselors")
        .select("id, name, contact_email, is_available, specialization, experience_years, bio, available_slots")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching counselors:", error.message);
        setCounselors([]);
      } else {
        setCounselors(data || []);
      }
      setLoading(false);
    };
    fetchCounselors();
  }, []);

  const handleAddCounselor = async () => {
    if (newCounselor.name && newCounselor.email) {
      setLoading(true);
      const { error } = await supabase
        .from("counselors")
        .insert({
          name: newCounselor.name,
          contact_email: newCounselor.email,
          is_available: true,
        });
      if (error) {
        console.error("Error adding counselor:", error.message);
      }
      setNewCounselor({ name: "", email: "" });
      // Refresh list
      const { data } = await supabase
        .from("counselors")
        .select("id, name, contact_email, is_available, specialization, experience_years, bio, available_slots")
        .order("created_at", { ascending: false });
      setCounselors(data || []);
      setLoading(false);
    }
  };

  const handleRemoveCounselor = async (id: string) => {
    setLoading(true);
    const { error } = await supabase
      .from("counselors")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Error removing counselor:", error.message);
    }
    // Refresh list
    const { data } = await supabase
      .from("counselors")
      .select("id, name, contact_email, is_available, specialization, experience_years, bio, available_slots")
      .order("created_at", { ascending: false });
    setCounselors(data || []);
    setLoading(false);
  };

  const handleToggleAvailability = async (id: string, current: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from("counselors")
      .update({ is_available: !current })
      .eq("id", id);
    if (error) {
      console.error("Error updating availability:", error.message);
    }
    // Refresh list
    const { data } = await supabase
      .from("counselors")
      .select("id, name, contact_email, is_available, specialization, experience_years, bio, available_slots")
      .order("created_at", { ascending: false });
    setCounselors(data || []);
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
          <h2 className="text-2xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">Manage global system configurations.</p>
      </div>
      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2">
          {/* AI Companion Settings */}
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><Bot className="mr-2"/>AI Companion Settings</CardTitle>
                  <CardDescription>Configure the behavior and crisis escalation protocols for the AI.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                      <Label htmlFor="ai-chat-enabled" className="flex flex-col space-y-1">
                          <span>AI Chat Enabled</span>
                          <span className="font-normal text-sm text-muted-foreground">
                          Globally enable or disable the AI chat feature.
                          </span>
                      </Label>
                      <Switch id="ai-chat-enabled" defaultChecked />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="crisis-keywords">Crisis Keywords</Label>
                      <Textarea 
                          id="crisis-keywords"
                          placeholder="suicide, self-harm, harm, abuse, assault, kill, helpless, worthless..."
                          defaultValue="suicide, self-harm, harm, abuse, assault, kill, helpless, worthless"
                          className="min-h-[100px]"
                      />
                      <p className="text-xs text-muted-foreground">
                          Keywords that will trigger immediate crisis escalation protocols.
                      </p>
                  </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                  <Button>Save AI Settings</Button>
              </CardFooter>
          </Card>

          {/* Community Management */}
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><MessageSquare className="mr-2"/>Community Management</CardTitle>
                  <CardDescription>Control community features and moderation settings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                      <Label htmlFor="community-enabled" className="flex flex-col space-y-1">
                          <span>Community Forum Enabled</span>
                          <span className="font-normal text-sm text-muted-foreground">
                          Allow students to access the community forum.
                          </span>
                      </Label>
                      <Switch id="community-enabled" defaultChecked />
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                      <Label htmlFor="auto-moderation" className="flex flex-col space-y-1">
                          <span>Auto-Moderation</span>
                          <span className="font-normal text-sm text-muted-foreground">
                          Automatically moderate posts for inappropriate content.
                          </span>
                      </Label>
                      <Switch id="auto-moderation" defaultChecked />
                  </div>
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                  <Button>Save Community Settings</Button>
              </CardFooter>
          </Card>

          {/* Counselor Management Card */}
          <Card className="lg:col-span-2">
              <CardHeader>
                  <CardTitle className="flex items-center"><Users className="mr-2"/>Counselor Management</CardTitle>
                  <CardDescription>Add, remove, and manage the availability of counselors.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Counselor List */}
                {loading ? (
                  <p className="text-center text-muted-foreground">Loading counselors...</p>
                ) : counselors.length === 0 ? (
                  <p className="text-center text-muted-foreground">No counselors found.</p>
                ) : (
                  counselors.map((counselor) => (
                    <div key={counselor.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-lg border p-4 gap-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{counselor.name}</span>
                        <span className="text-sm text-muted-foreground">{counselor.contact_email}</span>
                        {counselor.specialization && (
                          <span className="text-xs text-muted-foreground">{counselor.specialization}</span>
                        )}
                        {counselor.experience_years && (
                          <span className="text-xs text-muted-foreground">Experience: {counselor.experience_years} years</span>
                        )}
                        {counselor.bio && (
                          <span className="text-xs text-muted-foreground">{counselor.bio}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Switch
                          id={`counselor-${counselor.id}`}
                          checked={!!counselor.is_available}
                          onCheckedChange={() => handleToggleAvailability(counselor.id, !!counselor.is_available)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveCounselor(counselor.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              {/* Add New Counselor Form */}
              <CardFooter className="border-t p-6 flex-col items-start gap-4">
                  <h4 className="text-md font-semibold">Add New Counselor</h4>
                  <div className="flex flex-col sm:flex-row w-full gap-4">
                      <Input
                          placeholder="Counselor Name"
                          value={newCounselor.name}
                          onChange={(e) => setNewCounselor({ ...newCounselor, name: e.target.value })}
                          className="flex-grow"
                      />
                      <Input
                          type="email"
                          placeholder="Counselor Email"
                          value={newCounselor.email}
                          onChange={(e) => setNewCounselor({ ...newCounselor, email: e.target.value })}
                          className="flex-grow"
                      />
                      <Button onClick={handleAddCounselor}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add Counselor
                      </Button>
                  </div>
              </CardFooter>
          </Card>
      </div>
    </div>
  );
};

export default AdminSystemSettings;
