
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AIChatPage from "./pages/AIChatPage";
import BookingSystemPage from "./pages/BookingSystemPage";
import ResourceHubPage from "./pages/ResourceHubPage";
import BackendResourcesPage from "./pages/BackendResourcesPage";
import CommunityPage from "./pages/CommunityPage";
import AdminLayout from "./components/AdminLayout";
import CounselorManagement from "./components/CounselorManagement";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import AdminUserManagementPage from "./pages/AdminUserManagementPage";
import AdminContentManagementPage from "./pages/AdminContentManagementPage";
import AdminSystemSettingsPage from "./pages/AdminSystemSettingsPage";
import PeerHelperApplicationPage from "./pages/PeerHelperApplicationPage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import PostDetailPage from "./pages/PostDetailPage";
import ProfilePage from "./pages/ProfilePage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import SpeechChatPage from "./pages/SpeechChatPage";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./components/MainLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/" element={<Index />} />
            <Route path="/speech-chat" element={<SpeechChatPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                  <Route path="/ai-chat" element={<AIChatPage />} />
                  <Route path="/booking" element={<BookingSystemPage />} />
                  <Route path="/resources" element={<ResourceHubPage />} />
                  <Route path="/resources/backend" element={<BackendResourcesPage />} />
                  <Route path="/community" element={<CommunityPage />} />
                  <Route path="/community/post/:postId" element={<PostDetailPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/peer-helper-application" element={<PeerHelperApplicationPage />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="analytics" replace />} />
                <Route path="analytics" element={<AdminAnalyticsPage />} />
                <Route path="users" element={<AdminUserManagementPage />} />
                <Route path="content" element={<AdminContentManagementPage />} />
                <Route path="counselors" element={
                  <div className="space-y-8">
                    <div>
                      <h2 className="text-2xl font-bold">Counselor Management</h2>
                      <p className="text-muted-foreground">Manage counselors and their schedules</p>
                    </div>
                    <CounselorManagement />
                  </div>
                } />
                <Route path="settings" element={<AdminSystemSettingsPage />} />
              </Route>
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
