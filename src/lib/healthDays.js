// Fixed-date health awareness days shown on the welcome page.
// month is 1-12.
export const HEALTH_DAYS = [
  { month: 1, day: 30, name: 'World Leprosy Day', icon: '🩹', tone: 'blue' },
  { month: 2, day: 4, name: 'World Cancer Day', icon: '🎗️', tone: 'red' },
  { month: 3, day: 8, name: "International Women's Day", icon: '👩‍⚕️', tone: 'red' },
  { month: 3, day: 24, name: 'World TB Day', icon: '🫁', tone: 'blue' },
  { month: 4, day: 7, name: 'World Health Day', icon: '🌍', tone: 'mint' },
  { month: 5, day: 17, name: 'World Hypertension Day', icon: '🩺', tone: 'red' },
  { month: 5, day: 31, name: 'World No Tobacco Day', icon: '🚭', tone: 'blue' },
  { month: 6, day: 14, name: 'World Blood Donor Day', icon: '🩸', tone: 'red' },
  { month: 6, day: 21, name: 'International Yoga Day', icon: '🧘', tone: 'mint' },
  { month: 7, day: 1, name: "National Doctors' Day", icon: '🥼', tone: 'mint' },
  { month: 7, day: 28, name: 'World Hepatitis Day', icon: '💛', tone: 'blue' },
  { month: 8, day: 1, name: 'World Breastfeeding Week', icon: '🤱', tone: 'mint' },
  { month: 9, day: 29, name: 'World Heart Day', icon: '❤️', tone: 'red' },
  { month: 10, day: 10, name: 'World Mental Health Day', icon: '🧠', tone: 'mint' },
  { month: 10, day: 20, name: 'World Osteoporosis Day', icon: '🦴', tone: 'blue' },
  { month: 11, day: 14, name: 'World Diabetes Day', icon: '💧', tone: 'blue' },
  { month: 12, day: 1, name: 'World AIDS Day', icon: '🎗️', tone: 'red' },
  { month: 12, day: 3, name: 'World Disability Day', icon: '♿', tone: 'blue' },
  { month: 12, day: 12, name: 'Universal Health Coverage Day', icon: '💉', tone: 'mint' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Next `count` health days from `from` (today included), wrapping into next year. */
export function upcomingHealthDays(count = 3, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return HEALTH_DAYS.map((d) => {
    let date = new Date(today.getFullYear(), d.month - 1, d.day);
    if (date < today) date = new Date(today.getFullYear() + 1, d.month - 1, d.day);
    return { ...d, date, label: `${d.day} ${MONTHS[d.month - 1]}` };
  })
    .sort((a, b) => a.date - b.date)
    .slice(0, count);
}
