// Active typing time is supplied by the exercise, so pauses never create false drops.
export function createTypingMetrics() {
  let events = [];
  return {
    record(seconds, correct) { events.push({ time: Math.max(0, seconds), correct }); },
    reset() { events = []; },
    sample(seconds) {
      const now = Math.max(0, seconds);
      const last = Math.floor(now), first = Math.max(0, last - 29);
      const points = [];
      for (let second = first; second <= last; second++) {
        const end = second === last ? now : second;
        const start = Math.max(0, end - 5);
        const correct = events.filter(e => e.correct && e.time >= start && e.time <= end).length;
        const pace = end > 0 ? Math.round(correct * 12 / Math.max(1, Math.min(5, end))) : 0;
        const errors = events.filter(e => !e.correct && Math.floor(e.time) === second).length;
        points.push({ second, pace, errors });
      }
      const current = points.at(-1)?.pace || 0;
      const previous = points.at(-2)?.pace ?? current;
      return { points, pace: current, drop: Math.max(0, previous - current), totalErrors: events.filter(e => !e.correct).length };
    }
  };
}
