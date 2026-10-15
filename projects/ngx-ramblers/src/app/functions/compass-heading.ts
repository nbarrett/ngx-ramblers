export function smoothedCompassHeading(previous: number | null, next: number, factor: number): number {
  if (previous === null || !Number.isFinite(previous) || !Number.isFinite(factor) || factor >= 1) {
    return (next + 360) % 360;
  } else {
    const weight = factor < 0 ? 0 : factor;
    const delta = ((next - previous + 540) % 360) - 180;
    return (previous + delta * weight + 360) % 360;
  }
}

export function compassHeading(alpha: number, beta: number, gamma: number, screenAngle: number): number | null {
  const radians = Math.PI / 180;
  const yaw = alpha * radians;
  const pitch = beta * radians;
  const roll = gamma * radians;
  const screen = screenAngle * radians;
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);
  const sinRoll = Math.sin(roll);
  const cosRoll = Math.cos(roll);
  const screenRight = -Math.sin(screen);
  const screenUp = Math.cos(screen);
  const upEast = screenRight * (cosYaw * cosRoll - sinYaw * sinPitch * sinRoll) - screenUp * sinYaw * cosPitch;
  const upNorth = screenRight * (sinYaw * cosRoll + cosYaw * sinPitch * sinRoll) + screenUp * cosYaw * cosPitch;
  const upVertical = -screenRight * cosPitch * sinRoll + screenUp * sinPitch;
  const forwardEast = -cosYaw * sinRoll - sinYaw * sinPitch * cosRoll;
  const forwardNorth = -sinYaw * sinRoll + cosYaw * sinPitch * cosRoll;
  const normalVertical = cosPitch * cosRoll;
  const east = upEast * normalVertical + forwardEast * upVertical;
  const north = upNorth * normalVertical + forwardNorth * upVertical;
  return Math.hypot(east, north) > 0.01 && [alpha, beta, gamma, screenAngle].every(Number.isFinite)
    ? (Math.atan2(east, north) / radians + 360) % 360
    : null;
}
