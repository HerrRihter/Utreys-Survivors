type Goal = {
  id: string;
  title: string;
  desc: string;
  percent: number;
  progressText: string;
  unlock: string;
};

// The next achievements to finish, with what they open.
export function GoalList({ goals, title }: { goals: Goal[]; title: string }) {
  if (!goals.length) return null;
  return (
    <div className="goal-list" aria-label={title}>
      <h3>{title}</h3>
      {goals.map((goal) => (
        <div key={goal.id} className="goal">
          <div className="goal-head">
            <strong>{goal.title}</strong>
            <span>{goal.progressText}</span>
          </div>
          <small>
            {goal.desc}
            {goal.unlock ? ` · Открывает: ${goal.unlock}` : ''}
          </small>
          <div className="achievements-bar">
            <i style={{ width: `${goal.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
