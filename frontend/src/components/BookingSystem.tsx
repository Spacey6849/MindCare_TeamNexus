import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type AvailableSlot = { label?: string } | string;
interface Counselor { id: string; name: string; specialization: string | null; available_slots: AvailableSlot[] | null; }
const timeSlots = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];

const BookingSystem = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedCounselor, setSelectedCounselor] = useState<string>('');
  const [counselors, setCounselors] = useState<Counselor[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('counselors').select('id, name, specialization, available_slots').eq('is_available', true);
      if (error) { console.error(error); return; }
      setCounselors(data ?? []);
    })();
  }, []);

  // Reset selected time when counselor changes
  useEffect(() => { setSelectedTime(null); }, [selectedCounselor]);

  const getAvailableTimesForCounselor = (counselorId: string) => {
    const counselor = counselors.find(c => c.id === counselorId);
    // If available_slots is a JSON string, parse it
    let slots: AvailableSlot[] = [];
    if (counselor?.available_slots) {
      if (typeof counselor.available_slots === 'string') {
        try {
          slots = JSON.parse(counselor.available_slots);
        } catch {
          slots = [];
        }
      } else if (Array.isArray(counselor.available_slots)) {
        slots = counselor.available_slots;
      }
    }
    // fallback to default list if not provided or empty
    return slots.length > 0 ? slots.map((s: AvailableSlot) => (typeof s === 'string' ? s : (s.label ?? ''))) : timeSlots;
  };

  const handleBooking = async () => {
    if (!(selectedDate && selectedTime && selectedCounselor)) {
      toast({ title: 'Missing selection', description: 'Please select a counselor, date and time.', variant: 'destructive' });
      return;
    }
    if (!user?.id) { toast({ title: 'Please log in', description: 'You need to be logged in to book a session.' }); return; }
    const counselor = counselors.find(c => c.id === selectedCounselor);
    const dateStr = selectedDate.toISOString().split('T')[0];
    const time24 = selectedTime;
    const isoDateTime = new Date(`${dateStr}T${convertTo24Hour(time24)}:00`);
    const { error } = await supabase.from('bookings').insert({
      user_id: user.id,
      counselor_id: selectedCounselor,
      session_date: isoDateTime.toISOString(),
      session_type: 'counseling',
      status: 'pending',
      notes: null,
    });
    if (error) {
      toast({ title: 'Booking failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Booking requested', description: `Session with ${counselor?.name} on ${selectedDate.toDateString()} at ${selectedTime}` });
  };

  function convertTo24Hour(time: string) {
    // Very simple conversion expecting like "09:00 AM"
    const [hhmm, ampm] = time.split(' ');
    const [hh, mm] = hhmm.split(':').map(Number);
    const minutes = mm;
    if (ampm.toUpperCase() === 'PM' && hh !== 12) hh += 12;
    if (ampm.toUpperCase() === 'AM' && hh === 12) hh = 0;
    return `${String(hh).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  }

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
                <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                📅 Secure Your Session
                </Badge>
                <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Book a Confidential Session
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                Choose a time that works for you. All sessions are private, secure, and conducted by certified professionals.
                </p>
            </div>

            <Card className="shadow-soft border-border/50">
              <CardContent className="p-8 grid md:grid-cols-2 gap-8 items-start">
                <div>
                  <CardTitle className="mb-4">1. Select a Counselor</CardTitle>
                  <Select value={selectedCounselor} onValueChange={setSelectedCounselor}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a counselor" />
                    </SelectTrigger>
                    <SelectContent>
                      {counselors.map((counselor) => (
                        <SelectItem key={counselor.id} value={counselor.id}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{counselor.name}</span>
                            <span className="text-xs text-muted-foreground">{counselor.specialization}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <CardTitle className="mb-4">2. Select a Date</CardTitle>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border bg-background"
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                  />
                </div>
              </CardContent>
            </Card>

            {selectedCounselor && (
              <Card className="shadow-soft border-border/50 mt-6">
                <CardContent className="p-8">
                  <CardTitle className="mb-4">3. Select a Time</CardTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {getAvailableTimesForCounselor(selectedCounselor).map((slot) => (
                      <Button 
                        key={slot}
                        variant={selectedTime === slot ? "default" : "outline"}
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          <div className="mt-8 text-center">
            <Button size="lg" onClick={handleBooking} disabled={!selectedDate || !selectedTime || !selectedCounselor}>
                {selectedDate && selectedTime && selectedCounselor ? 
                  `Confirm Booking for ${selectedTime}` : 
                  'Complete Your Selection to Book'}
            </Button>
            {selectedDate && selectedTime && selectedCounselor && (
                <p className="text-sm text-muted-foreground mt-4">
                  You have selected {counselors.find(c => c.id === selectedCounselor)?.name} on {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {selectedTime}.
                </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookingSystem;
