import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/Button';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new () => BarcodeDetectorLike;
  }
}

interface Props {
  onDetected: (value: string) => void;
}

/**
 * مسح الباركود بالكاميرا عبر BarcodeDetector المدمج في المتصفح (يتوفر في Chrome على أندرويد).
 * إن لم يُدعم، يبقى الإدخال اليدوي متاحًا دائمًا.
 */
export function BarcodeScanner({ onDetected }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const callback = useRef(onDetected);
  callback.current = onDetected;

  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let timer: number | undefined;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        const Detector = window.BarcodeDetector;
        if (!Detector) throw new Error('unsupported');
        const detector = new Detector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = videoRef.current;
        if (stopped || !video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        timer = window.setInterval(async () => {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0 && !stopped) {
              callback.current(codes[0].rawValue);
              setOpen(false);
            }
          } catch {
            // إطار غير قابل للقراءة؛ نحاول في الدورة التالية
          }
        }, 400);
      } catch {
        if (!stopped) {
          setMessage('تعذر تشغيل الكاميرا. اسمح بالوصول للكاميرا أو اكتب الرقم يدويًا.');
          setOpen(false);
        }
      }
    })();

    return () => {
      stopped = true;
      if (timer !== undefined) window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open]);

  if (!supported) {
    return <p className="muted">مسح الباركود بالكاميرا غير مدعوم في هذا المتصفح. اكتب الرقم يدويًا.</p>;
  }

  return (
    <div>
      {open ? (
        <>
          <video ref={videoRef} className="scanner-video" playsInline muted />
          <Button variant="secondary" onClick={() => setOpen(false)}>
            إغلاق الكاميرا
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
        >
          مسح الباركود بالكاميرا
        </Button>
      )}
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
