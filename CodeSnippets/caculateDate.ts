//CME starts trading at 6pm... so for my date calculations,
//I start the date at 6pm when the market opens... that way all the candles belong to the same day starting at 6pm all the way the 5pm 
//the next day.

//This is how I calculate that date (using 5:30pm as the switch):
 // EST time + 6.5 hours to cope with 5pm close
 static getCMEDate(): string {
    // date ends at 5pm EST and starts at 6pm
    return DateTime.now()
      .setZone('America/New_York')
      .plus({
        hour: 6,
        minute: 30,
      })
      .toISO()
      .substring(0, 10);
  }