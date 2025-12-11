import { useEffect, useState } from 'react';
import { eventsApi } from '../api/events';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const Events = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
        <p className="text-secondary">We&apos;re reworking the events experience. Check back soon.</p>
      </div>
      <Card className="elevated">
        <h3>Coming soon</h3>
        <p className="text-secondary">
          We&apos;re refreshing meetups, workshops, and RSVPs to make it easier to join and track attendance.
        </p>
      </Card>
    </div>
  );
};

export default Events;

