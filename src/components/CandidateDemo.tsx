import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AssessmentEvent, MovementCategory } from '../types';
import { getFaceLandmarker } from '../utils/faceLandmarks';
import { classifyLandmarkMotion, MotionAnalysisResult } from '../utils/motionClassifier';

interface CandidateDemoProps {
  onAddEvent: (event: AssessmentEvent) => void;
  onNavigateToReviewer: () => void;
}

export const CandidateDemo: React.FC<CandidateDemoProps> = ({
  onAddEvent,
  onNavigateToReviewer,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState(false);

  // Landmarker and motion state
  const [detectorStatus, setDetectorStatus] = useState<
    'idle' | 'loading' | 'ready' | 'fallback'
  >('idle');
  const [currentMotion, setCurrentMotion] = useState<MotionAnalysisResult>({
    detectedCategory: 'Other',
    motionLabel: 'Neutral posture',
    deviationPercent: 0,
    pitchAngle: 0,
    rollAngle: 0,
    isSignificant: false,
  });

  const animFrameId = useRef<number | null>(null);
  const baselinePosition = useRef<{
    x: number;
    y: number;
    z: number;
    roll: number;
    span: number;
  } | null>(null);
  const positionHistory = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const lastDetectionTime = useRef<number>(0);
  const sustainedMotionTimer = useRef<number | null>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Movement context card state
  const [movementNoticed, setMovementNoticed] = useState(false);
  const [eventSource, setEventSource] = useState<'live_camera' | 'sample_scenario'>('live_camera');
  const [detectedCategoryName, setDetectedCategoryName] = useState<MovementCategory>('Stretching');
  const [motionDetailLabel, setMotionDetailLabel] = useState<string>('Movement noticed');
  const [candidateNote, setCandidateNote] = useState('');
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Check if running inside an iframe on mount
  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      setIsIframe(true);
    }
  }, []);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    baselinePosition.current = null;
    positionHistory.current = [];
    hasTriggeredRef.current = false;
  }, [stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  // Synchronize video element srcObject whenever stream or active state changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream && isCameraActive) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().catch(() => {});
      };
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream, isCameraActive]);

  // Start camera handler with robust fallback constraints
  const startCamera = async () => {
    setCameraError(null);
    setSubmissionSuccess(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      let mediaStream: MediaStream;
      try {
        // Attempt 1: Standard user-facing video with relaxed resolution
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err1) {
        // Attempt 2: Minimal fallback constraints
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err2) {
          throw err1; // Throw original descriptive error
        }
      }

      // 1. Immediately activate stream & display video (zero delay)
      setStream(mediaStream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }

      // 2. Start optical loop immediately for zero-delay motion detection
      startCanvasOpticalLoop();

      // 3. Load MediaPipe in the background without blocking video display
      setDetectorStatus('loading');
      getFaceLandmarker()
        .then((landmarker) => {
          if (landmarker) {
            setDetectorStatus('ready');
            startLandmarkLoop(landmarker);
          } else {
            setDetectorStatus('fallback');
          }
        })
        .catch(() => {
          setDetectorStatus('fallback');
        });
    } catch (err: unknown) {
      console.warn('Camera request failed:', err);
      const errorMsg =
        err instanceof Error ? err.name || err.message : 'Camera access failed.';

      if (
        errorMsg.includes('NotAllowedError') ||
        errorMsg.includes('PermissionDeniedError') ||
        errorMsg.includes('Permission denied')
      ) {
        setCameraError('PERMISSION_DENIED');
      } else if (
        errorMsg.includes('NotFoundError') ||
        errorMsg.includes('DevicesNotFoundError')
      ) {
        setCameraError('NO_DEVICE_FOUND');
      } else {
        setCameraError('UNAVAILABLE');
      }
      setIsCameraActive(false);
      setDetectorStatus('fallback');
    }
  };

  // Landmark tracking loop with live classification
  const startLandmarkLoop = (landmarker: any) => {
    const video = videoRef.current;
    if (!video) return;

    let framesCalibrated = 0;

    const detect = () => {
      if (!video || video.paused || video.ended || video.readyState < 2) {
        animFrameId.current = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      if (now - lastDetectionTime.current >= 90) {
        lastDetectionTime.current = now;

        try {
          const results = landmarker.detectForVideo(video, now);
          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const nose = landmarks[1];
            const leftEye = landmarks[33];
            const rightEye = landmarks[263];

            if (nose && leftEye && rightEye) {
              const currentRoll =
                (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) /
                Math.PI;

              // Calibrate initial neutral position over first 12 frames
              if (framesCalibrated < 12 || !baselinePosition.current) {
                baselinePosition.current = {
                  x: nose.x,
                  y: nose.y,
                  z: nose.z || 0,
                  roll: currentRoll,
                  span: Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y),
                };
                framesCalibrated++;
              } else {
                // Record position history for velocity detection
                positionHistory.current.push({ x: nose.x, y: nose.y, time: now });
                if (positionHistory.current.length > 6) {
                  positionHistory.current.shift();
                }

                // Classify live movement
                const analysis = classifyLandmarkMotion(
                  landmarks,
                  baselinePosition.current,
                  positionHistory.current
                );

                setCurrentMotion(analysis);

                // If movement is significant and not yet triggered in this session
                if (analysis.isSignificant && !hasTriggeredRef.current) {
                  if (!sustainedMotionTimer.current) {
                    sustainedMotionTimer.current = window.setTimeout(() => {
                      hasTriggeredRef.current = true;
                      setEventSource('live_camera');
                      setDetectedCategoryName(analysis.detectedCategory);
                      setMotionDetailLabel(analysis.motionLabel);
                      setMovementNoticed(true);
                      sustainedMotionTimer.current = null;
                    }, 500);
                  }
                } else {
                  if (sustainedMotionTimer.current) {
                    clearTimeout(sustainedMotionTimer.current);
                    sustainedMotionTimer.current = null;
                  }
                }
              }
            }
          }
        } catch {
          // If a frame drops, continue loop smoothly
        }
      }

      animFrameId.current = requestAnimationFrame(detect);
    };

    animFrameId.current = requestAnimationFrame(detect);
  };

  // Canvas optical motion loop (runs if MediaPipe task model fails to load)
  const startCanvasOpticalLoop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let prevImageData: Uint8ClampedArray | null = null;

    const analyzeFlow = () => {
      if (!video || video.paused || video.ended || video.readyState < 2) {
        animFrameId.current = requestAnimationFrame(analyzeFlow);
        return;
      }

      const now = performance.now();
      if (now - lastDetectionTime.current >= 120) {
        lastDetectionTime.current = now;

        canvas.width = 64;
        canvas.height = 48;
        ctx.drawImage(video, 0, 0, 64, 48);

        const currentFrame = ctx.getImageData(0, 0, 64, 48);
        const data = currentFrame.data;

        if (prevImageData) {
          let totalDiff = 0;
          let topDiff = 0;
          let bottomDiff = 0;
          let leftDiff = 0;
          let rightDiff = 0;

          for (let i = 0; i < data.length; i += 4) {
            const pixelDiff =
              (Math.abs(data[i] - prevImageData[i]) +
                Math.abs(data[i + 1] - prevImageData[i + 1]) +
                Math.abs(data[i + 2] - prevImageData[i + 2])) /
              3;

            if (pixelDiff > 25) {
              totalDiff++;
              const pixelIndex = i / 4;
              const y = Math.floor(pixelIndex / 64);
              const x = pixelIndex % 64;

              if (y < 24) topDiff++;
              else bottomDiff++;

              if (x < 32) leftDiff++;
              else rightDiff++;
            }
          }

          const activityPercent = Math.min(100, Math.round((totalDiff / (64 * 48)) * 100 * 4));

          let category: MovementCategory = 'Other';
          let label = 'Movement noticed';

          if (topDiff > bottomDiff * 1.6 && activityPercent > 20) {
            category = 'Stretching';
            label = 'Stretching or head adjustment';
          } else if (bottomDiff > topDiff * 1.5 && activityPercent > 20) {
            category = 'Getting water';
            label = 'Drinking water or cup reach';
          } else if (activityPercent > 55) {
            category = 'Sneezing';
            label = 'Sneezing or rapid reflex';
          } else if (Math.abs(leftDiff - rightDiff) > 120 && activityPercent > 18) {
            category = 'Other';
            label = 'Brief head turn';
          }

          setCurrentMotion({
            detectedCategory: category,
            motionLabel: activityPercent > 15 ? label : 'Within baseline',
            deviationPercent: activityPercent,
            pitchAngle: 0,
            rollAngle: 0,
            isSignificant: activityPercent > 22,
          });

          if (activityPercent > 22 && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            setEventSource('live_camera');
            setDetectedCategoryName(category);
            setMotionDetailLabel(label);
            setMovementNoticed(true);
          }
        }

        prevImageData = new Uint8ClampedArray(data);
      }

      animFrameId.current = requestAnimationFrame(analyzeFlow);
    };

    animFrameId.current = requestAnimationFrame(analyzeFlow);
  };

  // Trigger manual movement scenario (for instant demonstration)
  const triggerMovementScenario = (category: MovementCategory, label: string) => {
    setEventSource('sample_scenario');
    setDetectedCategoryName(category);
    setMotionDetailLabel(label);
    setMovementNoticed(true);
    setSubmissionSuccess(false);

    // Pre-fill suggested candidate notes matching the action
    if (category === 'Stretching') {
      setCandidateNote('I stretched because my neck was uncomfortable.');
    } else if (category === 'Getting water') {
      setCandidateNote('Took a sip from my water tumbler on the desk.');
    } else if (category === 'Sneezing') {
      setCandidateNote('Had a sudden sneeze and grabbed a tissue.');
    } else {
      setCandidateNote('Brief adjustment at my study desk.');
    }
  };

  // Submit candidate context to reviewer
  const handleSendContext = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0];

    const defaultNotes: Record<MovementCategory, string> = {
      Stretching: 'I stretched because my neck was uncomfortable.',
      'Getting water': 'Took a sip from my water tumbler on the desk.',
      Sneezing: 'Had a sudden sneeze and grabbed a tissue.',
      Other: 'Brief personal movement at desk.',
      'Prefer not to say': 'No context provided.',
    };

    const finalNote = candidateNote.trim() || defaultNotes[detectedCategoryName];

    const newEvent: AssessmentEvent = {
      id: `event-${Date.now()}`,
      timestamp: timeString,
      title:
        eventSource === 'sample_scenario'
          ? `Sample ${detectedCategoryName.toLowerCase()}`
          : motionDetailLabel,
      durationSec: 4.8,
      movementCategory: detectedCategoryName,
      candidateContext: finalNote,
      candidateSubmittedAt: timeString,
      status: 'Context received · human review only',
    };

    onAddEvent(newEvent);
    setMovementNoticed(false);
    setCandidateNote('');
    setSubmissionSuccess(true);
    hasTriggeredRef.current = false; // Reset trigger so next movement can be analyzed
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden processing canvas for optical analysis */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Title & Core Philosophy (Strictly one short sentence each) */}
      <div className="text-center space-y-2">
        <div className="inline-block px-2.5 py-0.5 border border-[#191816] bg-[#F8E3E3] text-[11px] font-mono-data uppercase tracking-wider text-[#191816]">
          Local demo · no recording
        </div>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#191816] tracking-tight">
          You can move. We ask what happened.
        </h1>
        <p className="text-xs sm:text-sm text-[#59564F] max-w-lg mx-auto">
          FairSignal principle: Movement is a signal to ask, not a reason to accuse.
        </p>
      </div>

      {/* Main 16:9 Video Canvas Frame */}
      <div className="border border-[#191816] bg-[#F4EFE6] relative overflow-hidden shadow-[3px_3px_0px_#191816]">
        <div className="aspect-video w-full bg-[#191816] relative flex items-center justify-center">
          {/* Always mounted video element for guaranteed reference and zero-latency playback */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
            className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
          />

          {isCameraActive ? (
            <>
              {/* Live Movement HUD */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="bg-[#191816] bg-opacity-90 border border-[#FAF8F3] px-3 py-1.5 text-xs font-mono-data text-[#FAF8F3]">
                  <div className="text-[10px] text-[#A8A49C] uppercase">
                    Live motion analysis:
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`w-2 h-2 ${
                        currentMotion.isSignificant ? 'bg-[#D9381E]' : 'bg-[#1D4ED8]'
                      }`}
                    />
                    <span className="font-semibold">{currentMotion.motionLabel}</span>
                    <span className="text-[#A8A49C]">
                      ({currentMotion.deviationPercent}% deviation)
                    </span>
                  </div>
                </div>

                <div className="bg-[#191816] bg-opacity-90 border border-[#FAF8F3] px-2.5 py-1 text-[11px] font-mono-data text-[#FAF8F3] hidden sm:block">
                  Classified as: <strong className="text-white">{currentMotion.detectedCategory}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center p-6 space-y-3">
              <div className="w-12 h-12 mx-auto border border-[#FAF8F3] bg-[#FAF8F3] flex items-center justify-center">
                <div className="w-4 h-4 bg-[#1D4ED8]" />
              </div>
              <div className="text-[#FAF8F3] font-serif-display text-lg">
                Camera preview inactive
              </div>
              <p className="text-xs text-[#A8A49C] max-w-sm mx-auto font-mono-data">
                Camera permission will be requested only when you click start below.
              </p>
            </div>
          )}

          {/* Active camera status badge */}
          {isCameraActive && (
            <div className="absolute top-3 left-3 bg-[#191816] text-[#FAF8F3] border border-[#FAF8F3] px-2.5 py-1 text-[11px] font-mono-data flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse" />
              <span>
                {detectorStatus === 'ready'
                  ? 'Live MediaPipe landmark motion active'
                  : detectorStatus === 'loading'
                  ? 'Initializing motion model...'
                  : 'Live camera active'}
              </span>
            </div>
          )}

          {/* Stop camera button overlay */}
          {isCameraActive && (
            <button
              type="button"
              onClick={stopCamera}
              className="absolute top-3 right-3 bg-[#D9381E] text-white border border-[#191816] px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#191816] hover:bg-[#BF2E16] active:translate-y-px transition-all"
            >
              Stop camera
            </button>
          )}
        </div>

        {/* Camera Control Strip */}
        <div className="p-4 bg-[#FAF8F3] border-t border-[#191816] flex flex-col sm:flex-row items-center justify-between gap-3">
          {!isCameraActive ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={startCamera}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#1D4ED8] text-white text-xs font-bold uppercase tracking-wider border border-[#191816] shadow-[2px_2px_0px_#191816] hover:bg-[#1842B6] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
              >
                Start camera
              </button>

              {/* Direct Window opener in case iframe blocks webcam */}
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-3 py-2 text-xs font-mono-data border border-[#191816] bg-white text-[#191816] hover:bg-[#F8E3E3] transition-colors"
                title="Open in full browser window to ensure camera permissions"
              >
                Open in new tab
              </button>
            </div>
          ) : (
            <div className="text-xs font-mono-data text-[#59564F]">
              Try stretching, taking a sip, or sneezing in front of your camera.
            </div>
          )}

          {/* "Try a movement" scenario buttons (allows instant testing anytime) */}
          <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto justify-end">
            <span className="text-[11px] font-mono-data text-[#59564F] mr-1">
              Try a movement:
            </span>
            <button
              type="button"
              onClick={() => triggerMovementScenario('Stretching', 'Stretching or neck adjustment')}
              className="px-2.5 py-1 bg-white text-[#191816] text-xs font-medium border border-[#191816] hover:bg-[#F8E3E3] active:translate-y-px transition-colors"
            >
              Stretching
            </button>
            <button
              type="button"
              onClick={() => triggerMovementScenario('Getting water', 'Drinking water or cup reach')}
              className="px-2.5 py-1 bg-white text-[#191816] text-xs font-medium border border-[#191816] hover:bg-[#F8E3E3] active:translate-y-px transition-colors"
            >
              Getting water
            </button>
            <button
              type="button"
              onClick={() => triggerMovementScenario('Sneezing', 'Sneezing or rapid reflex')}
              className="px-2.5 py-1 bg-white text-[#191816] text-xs font-medium border border-[#191816] hover:bg-[#F8E3E3] active:translate-y-px transition-colors"
            >
              Sneezing
            </button>
            <button
              type="button"
              onClick={() => triggerMovementScenario('Other', 'Other posture adjustment')}
              className="px-2.5 py-1 bg-white text-[#191816] text-xs font-medium border border-[#191816] hover:bg-[#F8E3E3] active:translate-y-px transition-colors"
            >
              Other
            </button>
          </div>
        </div>

        {/* Detailed camera troubleshooting card if permission is denied */}
        {cameraError && (
          <div className="p-4 bg-[#F8E3E3] border-t border-[#191816] text-xs text-[#191816] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <strong className="font-bold text-[#D9381E] font-mono-data uppercase block">
                  Camera Access Notice
                </strong>
                <p className="mt-1 text-[#38352E]">
                  Your browser blocked camera access. This happens frequently when previewing inside an embedded workspace iframe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCameraError(null)}
                className="font-bold underline text-xs"
              >
                Dismiss
              </button>
            </div>

            <div className="bg-white p-3 border border-[#191816] space-y-2">
              <div className="font-semibold text-[#191816]">
                Two quick ways to enable your camera:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#59564F] font-mono-data text-[11px]">
                <li>
                  Click the <strong>Open in dedicated window</strong> button below. Direct windows allow full browser camera permissions without iframe restrictions.
                </li>
                <li>
                  Look at your browser address bar: click the camera or lock icon next to the URL and toggle Camera to <strong>Allow</strong>, then reload.
                </li>
              </ol>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E5E0D5]">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-3 py-1.5 bg-[#191816] text-white font-bold uppercase tracking-wider text-[11px] border border-[#191816]"
                >
                  Open in dedicated window
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-white text-[#191816] font-bold uppercase tracking-wider text-[11px] border border-[#191816] hover:bg-[#FAF8F3]"
                >
                  Retry camera access
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono-data text-[#59564F]">
              Note: You can also use the <strong>Try a movement</strong> buttons above to test the exact context submission and reviewer evaluation flow right now.
            </div>
          </div>
        )}
      </div>

      {/* Movement Noticed Context Card (The Core Interaction) */}
      {movementNoticed && (
        <div className="border border-[#191816] bg-white p-5 shadow-[3px_3px_0px_#191816] transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E0D5]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#1D4ED8]" />
              <h2 className="font-serif-display text-lg font-bold text-[#191816]">
                {eventSource === 'sample_scenario'
                  ? `Sample movement: ${detectedCategoryName}. This does not mean a rule was broken.`
                  : `Movement noticed: ${detectedCategoryName}. This does not mean a rule was broken.`}
              </h2>
            </div>
            <span className="text-[11px] font-mono-data text-[#1D4ED8] font-bold uppercase hidden sm:inline">
              {eventSource === 'sample_scenario' ? 'SAMPLE SCENARIO' : 'LIVE CAMERA DETECTION'}
            </span>
          </div>

          <p className="text-xs text-[#59564F] mt-2">
            What was happening? Your context is attached directly to the event so the reviewer sees your explanation before evaluating.
          </p>

          <form onSubmit={handleSendContext} className="mt-4 space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-[11px] font-mono-data uppercase tracking-wider text-[#6E6A62] mb-2">
                Confirm or adjust category:
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'Stretching',
                    'Getting water',
                    'Sneezing',
                    'Other',
                    'Prefer not to say',
                  ] as MovementCategory[]
                ).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setDetectedCategoryName(category);
                      if (category === 'Stretching') {
                        setCandidateNote('I stretched because my neck was uncomfortable.');
                      } else if (category === 'Getting water') {
                        setCandidateNote('Took a sip from my water tumbler on the desk.');
                      } else if (category === 'Sneezing') {
                        setCandidateNote('Had a sudden sneeze and grabbed a tissue.');
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-medium border transition-all ${
                      detectedCategoryName === category
                        ? 'bg-[#191816] text-white border-[#191816]'
                        : 'bg-[#FAF8F3] text-[#191816] border-[#191816] hover:bg-[#F8E3E3]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional note */}
            <div>
              <label
                htmlFor="candidate-optional-note"
                className="block text-[11px] font-mono-data uppercase tracking-wider text-[#6E6A62] mb-1"
              >
                Optional candidate note:
              </label>
              <input
                id="candidate-optional-note"
                type="text"
                value={candidateNote}
                onChange={(e) => setCandidateNote(e.target.value)}
                placeholder="e.g. I stretched because my neck was uncomfortable."
                className="w-full p-2.5 text-xs border border-[#191816] bg-[#FAF8F3] text-[#191816] font-mono-data focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]"
              />
            </div>

            {/* Actions & Safeguard reassurance */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-[11px] font-mono-data text-[#6E6A62]">
                A candidate's silence must not be treated as guilt.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMovementNoticed(false)}
                  className="px-3 py-2 text-xs font-semibold text-[#59564F] hover:text-[#191816]"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1D4ED8] text-white text-xs font-bold uppercase tracking-wider border border-[#191816] shadow-[2px_2px_0px_#191816] hover:bg-[#1842B6] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                  Send context to reviewer
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Visible confirmation when context is submitted */}
      {submissionSuccess && (
        <div className="border border-[#191816] bg-[#F8E3E3] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#191816] font-mono-data">
            <strong>Context sent: </strong>
            Your note was recorded and attached to the reviewer's queue.
          </div>
          <button
            type="button"
            onClick={onNavigateToReviewer}
            className="px-3.5 py-1.5 bg-[#191816] text-[#FAF8F3] text-xs font-bold uppercase tracking-wider border border-[#191816] hover:bg-[#33312C] transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            Open Reviewer View →
          </button>
        </div>
      )}

      {/* Concise Privacy Notice (exact requirement) */}
      <div className="text-center pt-2">
        <p className="text-xs font-mono-data text-[#59564F]">
          Camera stays in this browser. No video is recorded or uploaded. Human review only.
        </p>
      </div>
    </div>
  );
};
