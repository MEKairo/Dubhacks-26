import React from 'react';
import GoogleCalendarConnect from './components/GoogleCalendarConnect.jsx';

export default function App() {
  return (
    <main className="calendar-test-page">
      <header>
        <p className="eyebrow">A little more time together</p>
        <h1>Our Calendar</h1>
        <p>Calendar connection test</p>
      </header>
      <GoogleCalendarConnect />
    </main>
  );
}
