// THisis how calculate the contract namefrom the symbol and date

import { DateTime } from 'luxon';

// usage: getContractName('ES', DateTime.fromFormat('2024-12-01', 'yyyy-LL-dd', { zone: 'America/New_York' }));

// Contract months for ES: March (H), June (M), September (U), December (Z)
const CONTRACT_MONTH_CODES: {
  [key: number]: string;
} = {
  1: 'H',
  2: 'H',
  3: 'H',
  4: 'M',
  5: 'M',
  6: 'M',
  7: 'U',
  8: 'U',
  9: 'U',
  10: 'Z',
  11: 'Z',
  12: 'Z',
};

// Rolls over on the Thursday before the 3rd Friday of the expiration month
export function getContractName(sym: string, date: DateTime): string {
  const year = date.year % 10; // Last digit of year
  let month: number = date.month;

  // Find the next contract month
  const contractMonths = Object.keys(CONTRACT_MONTH_CODES).map(Number);
  const nextContractMonth = contractMonths.find((m) => m >= month) || 3;

  // Find rollover date
  const expirationMonth = nextContractMonth;
  const thirdFriday = DateTime.local(date.year, expirationMonth, 15).plus({
    days: (5 - DateTime.local(date.year, expirationMonth, 15).weekday + 7) % 7,
  });
  // const rollOverDate = thirdFriday.minus({ days: 8 }); // Thursday before
  const rollOverDate = thirdFriday.minus({ days: 3 }); // Tuesday

  // Check if rollover has happened
  if (date >= rollOverDate) {
    // Move to the next contract
    const nextIndex = contractMonths.indexOf(expirationMonth) + 1;
    const nextMonth = contractMonths[nextIndex % contractMonths.length];
    month = nextMonth;
  }

  const contractCode = CONTRACT_MONTH_CODES[month];
  return `${sym}${contractCode}${year}`;
}
