import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 200 },  // Ramp up quickly to 200
    { duration: '20s', target: 500 },  // Push to 500
    { duration: '20s', target: 1000 }, // Push to 1000 concurrent VUs
    { duration: '10s', target: 2000 }, // Spike to 2000 VUs
    { duration: '10s', target: 0 },    // Ramp down to 0
  ],
};

// Generate random 24-character hex strings for mock MongoDB ObjectIds
function randomObjectId() {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default function () {
  const url = 'http://localhost:5555/api/attendance/bulk';
  
  // Simulate a kiosk sending 1-3 student records at once
  const numRecords = Math.floor(Math.random() * 3) + 1;
  const records = [];
  
  for (let i = 0; i < numRecords; i++) {
    records.push({
      studentId: randomObjectId(), // Mock student ID
      confidence: 0.98,
      markedBy: "face",
      slot: 1, // Must match a valid slot configuration if tested locally
      time: new Date().toISOString()
    });
  }

  const payload = JSON.stringify({ records });
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 201 or 400': (r) => r.status === 201 || r.status === 400, // 400 is possible if slot validation fails (e.g. out of time)
    'transaction time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // Wait 1 second before next request
}
