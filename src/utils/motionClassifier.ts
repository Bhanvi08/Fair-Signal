import { MovementCategory } from '../types';

export interface MotionAnalysisResult {
  detectedCategory: MovementCategory;
  motionLabel: string;
  deviationPercent: number;
  pitchAngle: number;
  rollAngle: number;
  isSignificant: boolean;
}

// Analyze MediaPipe landmarks to identify stretching, getting water, sneezing, or other
export function classifyLandmarkMotion(
  landmarks: Array<{ x: number; y: number; z: number }>,
  baseline: { x: number; y: number; z: number; roll: number; span: number },
  history: Array<{ x: number; y: number; time: number }>
): MotionAnalysisResult {
  const nose = landmarks[1]; // Nose tip
  const chin = landmarks[152]; // Chin
  const forehead = landmarks[10]; // Forehead
  const leftEye = landmarks[33]; // Outer left eye
  const rightEye = landmarks[263]; // Outer right eye
  const mouthTop = landmarks[13]; // Upper lip
  const mouthBottom = landmarks[14]; // Lower lip

  if (!nose || !chin || !forehead || !leftEye || !rightEye) {
    return {
      detectedCategory: 'Other',
      motionLabel: 'Movement noticed',
      deviationPercent: 30,
      pitchAngle: 0,
      rollAngle: 0,
      isSignificant: true,
    };
  }

  // Calculate Head Roll (tilt left/right in degrees)
  const dy = rightEye.y - leftEye.y;
  const dx = rightEye.x - leftEye.x;
  const currentRoll = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rollDiff = Math.abs(currentRoll - baseline.roll);

  // Calculate Pitch (tilted back / up vs tilted down)
  // Distance between forehead and chin, and vertical position of nose relative to forehead/chin
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  const noseVerticalRatio = (nose.y - forehead.y) / (faceHeight || 0.1);
  const pitchDiff = (nose.y - baseline.y) * 100; // positive = looking down, negative = looking up

  // Calculate Horizontal Yaw / Shift
  const horizontalShift = Math.abs(nose.x - baseline.x);

  // Check recent velocity (sudden drops characteristic of sneezing)
  const now = performance.now();
  let suddenDip = false;
  if (history.length >= 2) {
    const recent = history[history.length - 1];
    const prev = history[0];
    const timeDelta = (recent.time - prev.time) / 1000;
    if (timeDelta > 0.05 && timeDelta < 0.5) {
      const verticalVelocity = (recent.y - prev.y) / timeDelta;
      if (verticalVelocity > 0.35) {
        // rapid downward acceleration
        suddenDip = true;
      }
    }
  }

  // Distance from baseline position
  const displacement = Math.hypot(nose.x - baseline.x, nose.y - baseline.y);
  const deviationPercent = Math.min(100, Math.round(displacement * 280 + rollDiff * 1.5));

  // Classification Logic:
  // 1. Sneezing: Rapid sudden dip downward or sudden face occlusion
  if (suddenDip || (nose.y - baseline.y > 0.12 && displacement > 0.14)) {
    return {
      detectedCategory: 'Sneezing',
      motionLabel: 'Sneezing or sudden reflex',
      deviationPercent,
      pitchAngle: Math.round(pitchDiff),
      rollAngle: Math.round(currentRoll),
      isSignificant: true,
    };
  }

  // 2. Stretching: Leaning head back (nose moves up) or substantial neck roll
  if (nose.y - baseline.y < -0.05 || rollDiff > 14) {
    return {
      detectedCategory: 'Stretching',
      motionLabel: 'Stretching or neck adjustment',
      deviationPercent,
      pitchAngle: Math.round(pitchDiff),
      rollAngle: Math.round(currentRoll),
      isSignificant: true,
    };
  }

  // 3. Getting water / Hydration: Lower mouth area occluded or head tilted back slightly while hands present
  const mouthHeight = Math.hypot(mouthBottom.x - mouthTop.x, mouthBottom.y - mouthTop.y);
  if (mouthHeight < 0.005 || (nose.y < baseline.y - 0.03 && displacement > 0.06)) {
    return {
      detectedCategory: 'Getting water',
      motionLabel: 'Drinking water or cup reach',
      deviationPercent,
      pitchAngle: Math.round(pitchDiff),
      rollAngle: Math.round(currentRoll),
      isSignificant: true,
    };
  }

  // 4. Looking aside / head movement
  if (horizontalShift > 0.07) {
    return {
      detectedCategory: 'Other',
      motionLabel: 'Brief head turn or gaze shift',
      deviationPercent,
      pitchAngle: Math.round(pitchDiff),
      rollAngle: Math.round(currentRoll),
      isSignificant: true,
    };
  }

  // 5. Other general displacement
  if (deviationPercent > 20) {
    return {
      detectedCategory: 'Other',
      motionLabel: 'General movement noticed',
      deviationPercent,
      pitchAngle: Math.round(pitchDiff),
      rollAngle: Math.round(currentRoll),
      isSignificant: true,
    };
  }

  return {
    detectedCategory: 'Other',
    motionLabel: 'Within baseline',
    deviationPercent,
    pitchAngle: Math.round(pitchDiff),
    rollAngle: Math.round(currentRoll),
    isSignificant: false,
  };
}
