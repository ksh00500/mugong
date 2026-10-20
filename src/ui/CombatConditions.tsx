import type { Fighter } from '../domain/model';
import { activeConditions, type Condition } from '../platform/ui-copy';
import { t } from '../platform/i18n';
import { Icon } from './Icons';
import { useId, useState } from 'react';

function ConditionBadge({ condition }: { condition: Condition }) {
  return (
    <li data-condition={condition.id} data-severe={!!condition.severe}>
      <Icon
        name={
          condition.id === 'capturedTime'
            ? 'close'
            : condition.id === 'slowTime'
              ? 'arrow'
              : condition.id === 'freezeTime' || condition.id === 'coldTime'
                ? 'clock'
                : 'heart'
        }
      />
      <span>
        {t(condition.name)}
        {condition.stacks && ` ×${condition.stacks}`}
      </span>
      <small>{t('{0}초', { 0: Math.ceil(condition.remaining * 10) / 10 })}</small>
    </li>
  );
}
export function CombatConditions({ fighter }: { fighter: Fighter }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const conditions = activeConditions(fighter);
  if (!conditions.length) return null;
  return (
    <section className="combat-conditions" aria-label={t('현재 상태 이상')}>
      <ul>
        {conditions.slice(0, 2).map((condition) => (
          <ConditionBadge key={condition.id} condition={condition} />
        ))}
      </ul>
      {conditions.length > 2 && (
        <div
          className="condition-more"
          onKeyDown={(event) => {
            if (['Enter', ' ', 'Tab'].includes(event.key)) event.stopPropagation();
            if (event.key === 'Escape' && expanded) {
              event.stopPropagation();
              setExpanded(false);
            }
          }}
        >
          <button
            className="condition-toggle"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((value) => !value)}
          >
            <span aria-hidden="true">{expanded ? '▾' : '▸'} </span>
            {t('추가 상태 {0}개', { 0: conditions.length - 2 })}
          </button>
          {expanded && (
            <ul id={listId}>
              {conditions.slice(2).map((condition) => (
                <ConditionBadge key={condition.id} condition={condition} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
