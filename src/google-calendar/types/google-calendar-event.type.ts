type GoogleCalendarEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  htmlLink?: string;
};

export type GoogleCalendarEventList = {
  items: GoogleCalendarEvent[];
};
