import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { pl } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { UserAuth } from '../Context/AuthContext';
// TODO: Upewnij się, że ta ścieżka do Twojego klienta Supabase jest poprawna!
import { supabase } from "../Context/supabaseClient";
 

const locales = { pl };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const CustomToolbar = ({ label, onNavigate, view, onView }) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 select-none">
      <div className="flex items-center gap-2">
        <button onClick={() => onNavigate('PREV')} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition cursor-pointer">&larr; Poprzedni</button>
        <button onClick={() => onNavigate('TODAY')} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold transition cursor-pointer">Dzisiaj</button>
        <button onClick={() => onNavigate('NEXT')} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition cursor-pointer">Następny &rarr;</button>
      </div>
      <div className="text-2xl font-extrabold text-gray-800 capitalize text-center">{label}</div>
      <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
        {['month', 'week', 'day'].map((vName) => (
          <button key={vName} onClick={() => onView(vName)} className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${view === vName ? 'bg-white text-indigo-600 shadow font-bold' : 'text-gray-500 hover:text-gray-800'}`}>
            {vName === 'month' ? 'Miesiąc' : vName === 'week' ? 'Tydzień' : 'Dzień'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function CalendarPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { session } = UserAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.MONTH);
  const [events, setEvents] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  const [formData, setFormData] = useState({
    title: '', date: '', startTime: '12:00', location: '', description: ''
  });

  // 1. POBIERANIE WYDARZEŃ Z SUPABASE
  const fetchEvents = async () => {
    if (!groupId) return;
    
    // Pobieramy wydarzenia wraz ze wszystkimi odpowiedziami RSVP
    const { data, error } = await supabase
      .from('events')
      .select('*, event_rsvps(*)')
      .eq('group_id', groupId);

    if (error) {
      console.error("Błąd pobierania wydarzeń:", error);
      return;
    }

    // Mapujemy dane z bazy na format wymagany przez react-big-calendar
    const formattedEvents = data.map(ev => {
      // Łączymy datę i czas z bazy
      const startDateTime = new Date(`${ev.event_date}T${ev.event_time || '12:00:00'}`);
      // Z racji braku end_time w bazie, zakładamy domyślnie 1 godzinę czasu trwania
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); 

      return {
        ...ev,
        start: startDateTime,
        end: endDateTime,
      };
    });

    setEvents(formattedEvents);
  };

  useEffect(() => {
    fetchEvents();
    // Nasłuchiwanie na zmiany Realtime (kolega włączył to w SQL!)
    const channel = supabase
      .channel('public:events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { fetchEvents(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, () => { fetchEvents(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const openAddModal = () => {
    setEditingEventId(null);
    setFormData({ title: '', date: '', startTime: '12:00', location: '', description: '' });
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedEvent) return;
    setEditingEventId(selectedEvent.id);
    setFormData({
      title: selectedEvent.title,
      date: selectedEvent.event_date,
      startTime: selectedEvent.event_time ? selectedEvent.event_time.substring(0, 5) : '12:00',
      location: selectedEvent.location || '',
      description: selectedEvent.description || ''
    });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  // 2. ZAPISYWANIE I EDYCJA WYDARZEŃ
  // 2. ZAPISYWANIE I EDYCJA WYDARZEŃ
  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    const eventPayload = {
      group_id: groupId,
      title: formData.title,
      event_date: formData.date,
      event_time: `${formData.startTime}:00`,
      location: formData.location,
      description: formData.description,
      // Dodajemy jawnie ID twórcy, żeby spełnić politykę RLS kolegi
      created_by: session?.user?.id 
    };

    if (editingEventId) {
      const { error } = await supabase.from('events').update(eventPayload).eq('id', editingEventId);
      if (error) {
        alert("Błąd edycji: " + error.message);
        console.error("Szczegóły błędu:", error);
        return; // Zatrzymujemy działanie
      }
    } else {
      const { error } = await supabase.from('events').insert([eventPayload]);
      if (error) {
        alert("Błąd dodawania: " + error.message);
        console.error("Szczegóły błędu:", error);
        return; // Zatrzymujemy działanie
      }
    }
    
    setIsModalOpen(false);
    fetchEvents(); // Odśwież widok
  };
  // 3. USUWANIE WYDARZEŃ
  const handleDeleteEvent = async () => {
    if (!window.confirm("Czy na pewno chcesz usunąć to wydarzenie?")) return;
    
    const { error } = await supabase.from('events').delete().eq('id', selectedEvent.id);
    if (error) {
      console.error("Błąd usuwania:", error);
    } else {
      setSelectedEvent(null);
      fetchEvents();
    }
  };

  // 4. OBSŁUGA RSVP (Odpowiedzi Będę / Nie będę / Może)
  const handleRsvp = async (status) => {
    if (!selectedEvent || !session?.user) return;

    // "upsert" zaktualizuje odpowiedź jeśli istnieje, lub doda nową jeśli jej nie ma
    const { error } = await supabase.from('event_rsvps').upsert({
      event_id: selectedEvent.id,
      user_id: session.user.id,
      status: status
    }, { onConflict: 'event_id, user_id' });

    if (error) {
      console.error("Błąd przy głosowaniu RSVP:", error);
    } else {
      fetchEvents(); // Odświeża głosy
      // Podmieniamy otwarty selectedEvent na zaktualizowaną wersję żeby modal pokazał nowy głos
      setSelectedEvent(prev => ({...prev, event_rsvps: [...prev.event_rsvps.filter(r => r.user_id !== session.user.id), {user_id: session.user.id, status}] }));
    }
  };

  // Zliczanie głosów z podpiętej tabeli RSVP
  const rsvpCounts = selectedEvent?.event_rsvps?.reduce((acc, rsvp) => {
    acc[rsvp.status] = (acc[rsvp.status] || 0) + 1;
    return acc;
  }, { yes: 0, no: 0, maybe: 0 }) || { yes: 0, no: 0, maybe: 0 };
  
  const myRsvpStatus = selectedEvent?.event_rsvps?.find(r => r.user_id === session?.user?.id)?.status;
  const isCreator = selectedEvent && session?.user && selectedEvent.created_by === session.user.id;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 select-none">
      <div className="flex justify-between items-center mb-6">
        <div>
          <button onClick={() => navigate(`/groups/${groupId}`)} className="text-indigo-600 hover:underline mb-2 text-sm font-medium flex items-center cursor-pointer">
            &larr; Wróć do grupy
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Kalendarz wydarzeń</h1>
        </div>
        <button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg font-medium shadow transition-colors cursor-pointer">
          + Dodaj wydarzenie
        </button>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-gray-200 h-[700px]">
        <Calendar localizer={localizer} events={events} date={currentDate} onNavigate={setCurrentDate} view={currentView} onView={setCurrentView} onSelectEvent={setSelectedEvent} components={{ toolbar: CustomToolbar }} culture="pl" />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4">{editingEventId ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h2>
            <form onSubmit={handleSaveEvent} className="space-y-3">
              <input type="text" name="title" required placeholder="Nazwa wydarzenia" value={formData.title} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none" />
              <div className="flex gap-3">
                <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none" />
                <input type="time" name="startTime" required value={formData.startTime} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none" />
              </div>
              <input type="text" name="location" placeholder="Miejsce (np. Pub, Discord)" value={formData.location} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none" />
              <textarea name="description" placeholder="Dodatkowe informacje..." value={formData.description} onChange={handleInputChange} className="w-full border rounded-lg p-2.5 outline-none h-24"></textarea>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Anuluj</button>
                <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-2">{selectedEvent.title}</h2>
            <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg mb-4 text-sm">
              <p className="mb-1"><strong>Data:</strong> {format(selectedEvent.start, 'dd.MM.yyyy')}</p>
              <p><strong>Godzina:</strong> {format(selectedEvent.start, 'HH:mm')}</p>
            </div>
            
            {selectedEvent.location && <p className="text-gray-700 mb-2 text-sm"><span className="font-semibold text-gray-900">Miejsce:</span> {selectedEvent.location}</p>}
            {selectedEvent.description && <p className="text-gray-700 text-sm mt-3 p-3 bg-gray-50 rounded-lg"><span className="font-semibold text-gray-900 block mb-1">Opis:</span>{selectedEvent.description}</p>}
            
            {/* SEKCJA RSVP */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 mb-2">Twoja obecność:</h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => handleRsvp('yes')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${myRsvpStatus === 'yes' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>Będę</button>
                <button onClick={() => handleRsvp('no')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${myRsvpStatus === 'no' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>Nie będę</button>
                <button onClick={() => handleRsvp('maybe')} className={`flex-1 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${myRsvpStatus === 'maybe' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>Może</button>
              </div>
              <div className="text-xs text-gray-500 flex justify-between px-1">
                <span>Będą: {rsvpCounts.yes}</span>
                <span>Nie: {rsvpCounts.no}</span>
                <span>Może: {rsvpCounts.maybe}</span>
              </div>
            </div>

            {isCreator && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                <button onClick={openEditModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium cursor-pointer">Edytuj</button>
                <button onClick={handleDeleteEvent} className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg font-medium cursor-pointer">Usuń</button>
              </div>
            )}
            <button onClick={() => setSelectedEvent(null)} className="mt-3 w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-lg font-medium cursor-pointer">Zamknij</button>
          </div>
        </div>
      )}
    </div>
  );
}