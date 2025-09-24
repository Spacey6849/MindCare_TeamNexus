import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Phone, 
  MessageCircle, 
  ExternalLink, 
  Heart, 
  AlertTriangle,
  Users,
  Clock,
  Activity
} from "lucide-react";
import { MindCareAIAPI } from "@/lib/api";

interface ResourceData {
  emergency_contacts: {
    national_suicide_prevention_lifeline: string;
    crisis_text_line: string;
    emergency_services: string;
  };
  college_resources: {
    counseling_center: string;
    student_health_center: string;
    resident_advisor: string;
    academic_advisor: string;
  };
  online_resources: {
    mental_health_america: string;
    nami_college_resources: string;
    crisis_chat: string;
  };
  self_care_tips: string[];
  when_to_seek_help: string[];
  status: string;
}

const BackendResourcesPage = () => {
  const [resources, setResources] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
  const data = await MindCareAIAPI.getResources();
      setResources(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching resources:', err);
      setError('Failed to load resources. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-8">Mental Health Resources</h1>
            <p className="text-muted-foreground">Loading resources...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-8">Mental Health Resources</h1>
            <Card className="p-6">
              <CardContent>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={fetchResources}>Retry</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!resources) {
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              🏥 Mental Health Resources
            </Badge>
            <h1 className="text-4xl font-bold mb-4">
              Support & Resources
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive mental health resources and support contacts for college students.
              These resources are provided by our AI therapy assistant backend.
            </p>
          </div>

          <div className="grid gap-6">
            {/* Emergency Contacts */}
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <Phone className="h-5 w-5" />
                  Emergency Contacts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <h4 className="font-semibold mb-2">Crisis Hotline</h4>
                    <p className="text-2xl font-bold text-destructive">
                      {resources.emergency_contacts.national_suicide_prevention_lifeline}
                    </p>
                  </div>
                  <div className="text-center">
                    <h4 className="font-semibold mb-2">Crisis Text</h4>
                    <p className="text-sm">
                      {resources.emergency_contacts.crisis_text_line}
                    </p>
                  </div>
                  <div className="text-center">
                    <h4 className="font-semibold mb-2">Emergency</h4>
                    <p className="text-2xl font-bold text-destructive">
                      {resources.emergency_contacts.emergency_services}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* College Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  College Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Counseling Center</h4>
                    <p className="text-sm text-muted-foreground">
                      {resources.college_resources.counseling_center}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Student Health Center</h4>
                    <p className="text-sm text-muted-foreground">
                      {resources.college_resources.student_health_center}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Resident Advisor</h4>
                    <p className="text-sm text-muted-foreground">
                      {resources.college_resources.resident_advisor}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Academic Advisor</h4>
                    <p className="text-sm text-muted-foreground">
                      {resources.college_resources.academic_advisor}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Online Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Online Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Button variant="outline" asChild className="w-full justify-start">
                      <a href={resources.online_resources.mental_health_america} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Mental Health America
                      </a>
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" asChild className="w-full justify-start">
                      <a href={resources.online_resources.nami_college_resources} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        NAMI College Resources
                      </a>
                    </Button>
                  </div>
                  <div>
                    <Button variant="outline" asChild className="w-full justify-start">
                      <a href={resources.online_resources.crisis_chat} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Crisis Chat Support
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Self Care Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Self-Care Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid md:grid-cols-2 gap-2">
                  {resources.self_care_tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Activity className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* When to Seek Help */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  When to Seek Help
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid md:grid-cols-2 gap-2">
                  {resources.when_to_seek_help.map((sign, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Clock className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      {sign}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackendResourcesPage;