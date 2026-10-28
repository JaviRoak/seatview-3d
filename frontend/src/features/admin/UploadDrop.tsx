/** Selector de archivo con arrastrar y soltar, previsualización, validación local y barra de progreso. */
import { useRef, useState, type DragEvent } from 'react';
import { adminApi } from '../../api';
import type { MediaAsset } from '../../api/types';

export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 2 * 1024 * 1024;

export function validateImageFile(file: File, maxBytes = MAX_BYTES): string | null {
  if (!ALLOWED.includes(file.type)) return 'Solo se permiten imágenes JPEG, PNG o WebP.';
  if (file.size > maxBytes) return `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`;
  return null;
}

export function UploadDrop({ onUploaded, onError }: { onUploaded: (a: MediaAsset) => void; onError: (msg: string) => void }) {
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const err = validateImageFile(f);
    if (err) { onError(err); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); };
  const confirm = async () => {
    if (!file) return;
    setProgress(0);
    try {
      const asset = await adminApi.upload(file, setProgress);
      onUploaded(asset);
      setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null);
    } catch (e) { onError((e as Error).message); } finally { setProgress(null); }
  };

  return (
    <div>
      <div className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
        onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
        {preview ? <img src={preview} alt="Previsualización" style={{ maxHeight: 140, borderRadius: 8, maxWidth: '100%' }} /> : 'Arrastra una imagen aquí o haz clic para elegirla'}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {file && (
        <div style={{ marginTop: '0.5rem' }}>
          <div className="muted" style={{ fontSize: '0.82rem' }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
          {progress !== null && <div className="progress" style={{ margin: '0.4rem 0' }}><span style={{ width: `${progress}%` }} /></div>}
          <div className="row-actions">
            <button className="btn-primary" disabled={progress !== null} onClick={confirm}>{progress === null ? 'Subir y asignar' : `Subiendo… ${progress}%`}</button>
            <button className="btn-ghost" disabled={progress !== null} onClick={() => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
