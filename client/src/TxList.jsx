import { Fragment } from 'react';
import { CAT_ICON, dayLabel, rp } from './util';

export default function TxList({ items, actions, pendingId, onEdit, onDelete }) {
  let last = '';
  return items.map((x) => {
    const head = x.date !== last ? <div className="day">{dayLabel(x.date)}</div> : null;
    last = x.date;
    const inc = x.type === 'income';
    return (
      <Fragment key={x.id}>
        {head}
        <div className="tx">
          <div className={'ic' + (inc ? ' i' : '')}>{CAT_ICON[x.category] || '💳'}</div>
          <div>
            {x.category || 'Tanpa kategori'}
            <small>
              {x.time && <>{x.time} · </>}{x.wallet} · {x.note || 'Tanpa catatan'}
              {actions && <>
                {' · '}<button className="lnk" onClick={() => onEdit(x)}>Ubah</button>
                <button className="lnk d" onClick={() => onDelete(x)}>{pendingId === x.id ? 'Yakin hapus?' : 'Hapus'}</button>
              </>}
            </small>
          </div>
          <strong className={inc ? 'in' : 'out'}>{inc ? '+' : '−'}{rp(x.amount)}</strong>
        </div>
      </Fragment>
    );
  });
}
