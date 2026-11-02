// Pure grade math, kept free of DOM so it can be unit tested.

const PLUS_MINUS = [
  [97, 'A+', 4.0], [93, 'A', 4.0], [90, 'A-', 3.7],
  [87, 'B+', 3.3], [83, 'B', 3.0], [80, 'B-', 2.7],
  [77, 'C+', 2.3], [73, 'C', 2.0], [70, 'C-', 1.7],
  [67, 'D+', 1.3], [63, 'D', 1.0], [60, 'D-', 0.7],
  [0, 'F', 0.0],
];

export const SCALES = {
  standard: { label: '4.0 scale (A+ = 4.0)', rows: PLUS_MINUS },
  plus: { label: '4.3 scale (A+ = 4.3)', rows: PLUS_MINUS.map((r) => (r[1] === 'A+' ? [97, 'A+', 4.3] : r)) },
  simple: { label: '4.0 scale, no +/−', rows: [[90, 'A', 4], [80, 'B', 3], [70, 'C', 2], [60, 'D', 1], [0, 'F', 0]] },
};

export const LEVELS = [
  [0, 'Regular'],
  [0.5, 'Honors'],
  [1, 'AP / IB'],
];

const scaleRows = (scale) => (SCALES[scale] || SCALES.standard).rows;

export const letterFromScore = (score, scale) => {
  if (score == null || isNaN(score)) return null;
  return scaleRows(scale).find((r) => score >= r[0])[1];
};

export const letterOf = (course, scale) => course.letter || letterFromScore(course.score, scale);

// Grade points for a course. Canvas's own letter (the school's grading scheme) wins over the percentage.
export const pointsFor = (course, scale, whatIf) => {
  const rows = scaleRows(scale);
  const letter = (whatIf || letterOf(course, scale) || '').trim().toUpperCase();
  if (!letter) return null;
  const exact = rows.find((r) => r[1] === letter);
  if (exact) return exact[2];
  const base = rows.find((r) => r[1] === letter.replace(/[+\-−]/g, ''));
  if (base && scale === 'simple') return base[2];
  if (course.score == null) return null;
  return rows.find((r) => course.score >= r[0])[2];
};

/**
 * courses: [{ id, score, letter, hidden }]
 * cfg: courseId -> { credits, weight, skip, whatIf }
 * past: { gpa, credits, weighted }
 */
export const computeGpa = (courses, cfg, scale, past = {}) => {
  let credits = 0;
  let unweighted = 0;
  let weighted = 0;
  courses.forEach((c) => {
    const g = Object.assign({ credits: 1, weight: 0, skip: false, whatIf: '' }, cfg[c.id]);
    const pts = c.hidden && !g.whatIf ? null : pointsFor(c, scale, g.whatIf);
    if (g.skip || pts == null || !(g.credits > 0)) return;
    credits += g.credits;
    unweighted += pts * g.credits;
    weighted += (pts > 0 ? pts + g.weight : 0) * g.credits;
  });
  if (!credits) return null;
  const out = { unweighted: unweighted / credits, weighted: weighted / credits, credits, cumulative: null };
  const pg = Number(past.gpa);
  const pc = Number(past.credits);
  if (pc > 0 && pg >= 0) {
    const term = past.weighted ? out.weighted : out.unweighted;
    out.cumulative = (pg * pc + term * credits) / (pc + credits);
  }
  return out;
};

// Score needed on a final worth `weightPct` percent of the grade to finish at `target` percent.
export const neededOnFinal = (current, weightPct, target) => {
  const w = weightPct / 100;
  if (!(w > 0 && w <= 1) || current == null || target == null) return null;
  return (target - current * (1 - w)) / w;
};
