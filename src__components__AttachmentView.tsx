import { useEffect, useState } from 'react';
import { loadAttachment, type AttachmentView as View } from '@/core/services/attachmentService';

/** يعرض مرفقًا محليًا (صورة أو PDF). رابط الكائن يُحرَّر عند الإزالة. */
export function AttachmentThumb({ id, size = 80 }: { id: string; size?: number }) {
  const [view, setView] = useState<View | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let created: string | null = null;
    loadAttachment(id)
      .then((v) => {
        if (!alive || !v) return;
        created = URL.createObjectURL(v.blob);
        setView(v);
        setUrl(created);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);

  if (!view || !url) return <span className="muted">…</span>;
  if (view.kind === 'pdf') {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        📄 {view.name}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={view.name} width={size} height={size} className="thumb" />
    </a>
  );
}

export function AttachmentList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  return (
    <div className="thumbs">
      {ids.map((id) => (
        <AttachmentThumb key={id} id={id} />
      ))}
    </div>
  );
}
