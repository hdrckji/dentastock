"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

type BarcodeScannerProps = {
  onDetected: (code: string) => void;
  buttonLabel?: string;
};

export function BarcodeScanner({ onDetected, buttonLabel = "Scanner" }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function startScanner() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setError("Caméra non disponible sur cet appareil.");
          return;
        }

        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        const videoElement = videoRef.current;
        if (!videoElement) {
          return;
        }

        const controls = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoElement,
          (result) => {
            if (!result || cancelled) {
              return;
            }

            const text = result.getText()?.trim();
            if (!text) {
              return;
            }

            onDetected(text);
            setOpen(false);
          }
        );

        controlsRef.current = controls;
      } catch {
        setError("Impossible d'activer la caméra. Vérifie les permissions.");
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;

      const stream = videoRef.current?.srcObject;
      if (stream && stream instanceof MediaStream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    };
  }, [open, onDetected]);

  function closeScanner() {
    setOpen(false);
    setError("");
    controlsRef.current?.stop();
    controlsRef.current = null;
  }

  return (
    <>
      <button type="button" className="scanner-trigger" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {open ? (
        <div className="scanner-modal" role="dialog" aria-modal="true" aria-label="Scanner code-barres">
          <div className="scanner-card">
            <div className="scanner-head">
              <strong>Scanner code-barres</strong>
              <button type="button" className="scanner-close" onClick={closeScanner}>
                Fermer
              </button>
            </div>
            <p className="muted">Pointe la caméra vers le code-barres de la boîte.</p>
            <video ref={videoRef} className="scanner-video" muted autoPlay playsInline />
            {error ? <p className="notice">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
