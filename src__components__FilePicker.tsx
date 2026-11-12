import { useRef } from 'react';
import { Button } from './Button';
import { checkFiles } from '@/core/services/attachmentService';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  /** يفتح الكاميرا مباشرة على الهاتف */
  camera?: boolean;
  multiple?: boolean;
  onProblem?: (message: string | null) => void;
}

export function FilePicker({ files, onChange, accept = 'image/jpeg,image/png,image/webp,application/pdf', camera, multiple = true, onProblem }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next = multiple ? [...files, ...Array.from(list)] : [list[0]];
    const problem = checkFiles(next);
    onProblem?.(problem);
    if (!problem) onChange(next);
  }

  return (
    <div className="form">
      <div className="chips">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          اختيار ملف
        </Button>
        {camera && (
          <Button variant="secondary" onClick={() => camRef.current?.click()}>
            تصوير بالكاميرا
          </Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept={accept} multiple={multiple} hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {files.length > 0 && (
        <ul className="plain-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.name}{' '}
              <button type="button" className="btn-link" onClick={() => onChange(files.filter((_, j) => j !== i))}>
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
