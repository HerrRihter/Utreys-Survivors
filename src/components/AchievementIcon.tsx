import type { CSSProperties } from 'react';

// Engraved circuit badges, drawn on the same grid so they stay legible at menu size.
const chip =
  'M23 23H41V41H23Z M27 18V23 M37 18V23 M27 41V46 M37 41V46 M18 27H23 M18 37H23 M41 27H46 M41 37H46';
const shield = 'M32 17L45 22V32L41 41L32 47L23 41L19 32V22Z';
const server = 'M21 19H43V27H21Z M21 31H43V39H21Z M25 23H27 M25 35H27 M32 23H39 M32 35H39';
const packet = 'M20 25L32 19L44 25V39L32 46L20 39Z M20 25L32 32L44 25 M32 32V46';
type Badge = { path: string; color: string; rank?: number };
const badges: Record<string, Badge> = {
  platinum: {
    path: 'M22 18H42V29L38 36L32 40L26 36L22 29Z M22 22H16V28L22 33 M42 22H48V28L42 33 M32 40V46 M25 47H39 M32 22L37 28L32 34L27 28Z M13 39L16 42L13 45L10 42Z M51 12V18 M48 15H54',
    color: '#e0edff',
    rank: 4,
  },
  abilities_10: { path: chip + ' M34 26L28 33H35L30 38', color: '#60e5ff', rank: 1 },
  abilities_50: {
    path: 'M18 25H37L32 20 M37 25L32 30 M46 39H27L32 34 M27 39L32 44 M20 32H44',
    color: '#60e5ff',
    rank: 2,
  },
  abilities_100: {
    path: 'M18 20H25V27H18Z M39 37H46V44H39Z M25 23H35V41H39 M18 41H28V32H45 M41 28L45 32L41 36',
    color: '#60e5ff',
    rank: 3,
  },
  abilities_250: {
    path: chip + ' M28 28H36V36H28Z M17 18V13H25 M39 13H47V18 M17 46V51H25 M39 51H47V46',
    color: '#c2a0ff',
    rank: 4,
  },
  survive_run_60: {
    path: 'M22 16H42 M32 16V21 M32 22A12 12 0 1 0 44 34 M32 27V34L39 38 M17 34H23L27 29L32 39L37 32H48',
    color: '#64dfd1',
    rank: 1,
  },
  survive_run_180: { path: shield + ' M24 32H29L32 26L35 37L38 32H42', color: '#64dfd1', rank: 2 },
  survive_run_300: {
    path: 'M20 28A13 13 0 0 1 43 23L46 27 M46 19V27H38 M44 36A13 13 0 0 1 21 41L18 37 M18 45V37H26 M27 32L31 36L38 28',
    color: '#64dfd1',
    rank: 3,
  },
  survive_total_600: {
    path: server + ' M18 46H25L29 41L34 49L39 43H46',
    color: '#64dfd1',
    rank: 4,
  },
  kills_10: { path: packet, color: '#efbd70', rank: 1 },
  kills_100: {
    path: packet + ' M36 36L39 39L46 32 M16 19H23 M16 23H19',
    color: '#efbd70',
    rank: 2,
  },
  kills_500: {
    path: 'M18 20H26V28H18Z M38 20H46V28H38Z M20 39H28V47H20Z M36 39H44V47H36Z M26 24H32V33 M38 24H32 M24 39V33H40V39',
    color: '#efbd70',
    rank: 3,
  },
  boss_crpt: {
    path: 'M17 45H47 M20 41V25L32 17L44 25V41 M19 25H45 M25 29V38 M39 29V38 M28 40L32 44L39 35 M29 23H35',
    color: '#ff8175',
    rank: 4,
  },
  codes_100: {
    path: 'M19 20H28V29H19Z M36 20H45V29H36Z M19 37H28V46H19Z M36 37H40V41H45V46H36 M32 19V32H45 M19 33H28 M32 37V46',
    color: '#efbd70',
  },
  upgrades_10: { path: server + ' M27 48L32 43L37 48 M32 43V53 M46 18V38', color: '#91b7ff' },
  win_utrace: {
    path: 'M21 22V36L26 42H38L43 36V22 M27 22V34L30 37H34L37 34V22 M19 18H45',
    color: '#60dfff',
    rank: 4,
  },
  win_traceability: {
    path: 'M18 22H28V32H18Z M36 32H46V42H36Z M28 27H36V37 M22 36V43H31 M33 21H42V28',
    color: '#6de2cd',
    rank: 4,
  },
  win_serialization: {
    path: 'M19 24V40 M24 24V40 M32 24V40 M36 24V40 M43 24V40 M17 19H47 M17 45H47 M25 32H46L41 27 M46 32L41 37',
    color: '#fa7966',
    rank: 4,
  },
  win_ba: {
    path: 'M22 18H38L44 24V44H22Z M38 18V25H44 M26 29L28 31L31 27 M35 29H40 M26 37L28 39L31 35 M35 37H40',
    color: '#f7ce70',
    rank: 4,
  },
  win_qa: {
    path: 'M18 26V18H26 M38 18H46V26 M18 38V46H26 M38 46H46V38 M23 32L29 38L41 25 M32 16V21 M16 32H21 M43 32H48',
    color: '#79edbd',
    rank: 4,
  },
  load_5: {
    path: 'M19 43V34H25V43 M29 43V27H35V43 M39 43V19H45V43 M17 47H47 M19 26L30 18L35 21',
    color: '#ffba67',
    rank: 2,
  },
  load_10: {
    path: 'M28 18L23 28L24 33L19 30V38L24 46H40L46 38V29L41 33L38 22L33 16L34 29L29 34L28 18Z M29 43L32 35L36 43',
    color: '#ff8175',
    rank: 4,
  },
  production_300: { path: server + ' M17 16V44H47 M28 47L31 50L39 43', color: '#79edbd', rank: 3 },
  weapon_kills_500: {
    path: 'M19 40L34 25L32 19L39 16L38 23L43 26L48 22V30L42 33L38 31L23 46Z M22 40L25 43 M17 19L22 24 M18 29H13',
    color: '#91b7ff',
  },
  untouched_180: {
    path: shield + ' M32 25L38 32L32 40L26 32Z M13 18L16 21 M48 19L51 16 M48 39L51 42',
    color: '#b8edff',
  },
  clean_sweep: {
    path: 'M27 25H37V39L32 43L27 39Z M28 25V20H36V25 M21 24L27 29 M37 29L43 24 M20 34H27 M37 34H44 M22 43L27 38 M37 38L42 43 M18 46L46 18',
    color: '#79edbd',
  },
  workaround_win: {
    path: 'M17 24H25V32H17Z M39 24H47V32H39Z M25 28H28 M36 28H39 M28 24L36 32 M36 24L28 32 M21 36V43H43V36 M38 39L43 35L48 39',
    color: '#efbd70',
  },
  no_food_win: {
    path: 'M28 23A11 11 0 1 0 40 37 M18 19V28H24V19 M21 28V45 M45 19V45 M45 19L40 28V32H45 M16 48L48 16',
    color: '#efbd70',
  },
  speed_win: {
    path: 'M29 17H39 M34 17V22 M27 24A12 12 0 1 1 24 41 M34 27V34L40 30 M15 28H25 M12 34H23 M16 40H22',
    color: '#60e5ff',
  },
  evolutions_3: {
    path: 'M23 18C23 32 41 32 41 46 M41 18C41 32 23 32 23 46 M25 22H39 M27 28H37 M27 36H37 M25 42H39 M16 25V39 M12 29L16 25L20 29 M48 39V25 M44 29L48 25L52 29',
    color: '#c2a0ff',
    rank: 3,
  },
};

export function AchievementIcon({ id }: { id: string }) {
  const badge = badges[id] ?? { path: chip, color: '#60e5ff' };
  return (
    <svg
      className="achievement-emblem"
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={{ '--emblem-color': badge.color } as CSSProperties}
    >
      <path d="M13 3H51L61 13V51L51 61H13L3 51V13Z" fill="#061218" stroke="#36515c" />
      <path
        d="M15 7H49L57 15V49L49 57H15L7 49V15Z"
        fill="currentColor"
        fillOpacity=".08"
        stroke="currentColor"
        strokeOpacity=".4"
      />
      <path
        d="M9 22V15L15 9H22 M42 55H49L55 49V42"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M12 32H17 M47 32H52 M32 9V13 M32 51V55" stroke="currentColor" opacity=".22" />
      <path
        d={badge.path}
        transform="translate(0 1)"
        fill="none"
        stroke="#000"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d={badge.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="square"
      />
      {Array.from({ length: badge.rank ?? 0 }, (_, i) => (
        <path key={i} d={`M${32 - (badge.rank! * 6) / 2 + i * 6} 53h4v3h-4Z`} fill="#ffe0a0" />
      ))}
    </svg>
  );
}
