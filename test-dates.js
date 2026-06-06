const { parseISO, startOfDay, format } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

const TZ = 'Asia/Riyadh';

function testDates() {
  const dateAnchor = '2026-06-02';
  
  // 1. How backend parses dateAnchor:
  const referenceDate = dateAnchor ? parseISO(dateAnchor) : toZonedTime(Date.now(), TZ);
  console.log('referenceDate:', referenceDate.toISOString());
  console.log('referenceDate local values:', referenceDate.toString());
  
  const startDate = startOfDay(referenceDate);
  console.log('startDate:', startDate.toISOString());
  console.log('startDate local values:', startDate.toString());
  
  const formatted = format(startDate, 'yyyy-MM-dd');
  console.log('formatted:', formatted);
  
  // What if we zone the parsed date?
  const zonedRef = toZonedTime(parseISO(dateAnchor), TZ);
  console.log('zonedRef:', zonedRef.toISOString());
  
  // What does toZonedTime(Date.now(), TZ) do?
  const nowZoned = toZonedTime(Date.now(), TZ);
  console.log('nowZoned:', nowZoned.toISOString());
  console.log('nowZoned startOfDay:', startOfDay(nowZoned).toISOString());
}

testDates();
