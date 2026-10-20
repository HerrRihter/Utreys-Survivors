import { useSession } from '../session';

export function SoundButton({ id, enabled }: { id: string; enabled: boolean }) {
  const session = useSession();
  return (
    <button
      id={id}
      className="small"
      type="button"
      aria-label="Переключить звук"
      aria-pressed={enabled}
      onClick={session.commands.toggleSound}
    >
      ЗВУК: {enabled ? 'ВКЛ' : 'ВЫКЛ'}
    </button>
  );
}
