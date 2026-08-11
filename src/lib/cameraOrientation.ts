export type QuarterTurn = "cw" | "ccw";
export type XY = { x: number; y: number };

/**
 * A portrait-locked browser uses a clockwise CSS rotation for the camera UI.
 * The normal capture grip (rear camera on the left) therefore needs the pixel
 * frame turned counter-clockwise to become the canonical saved landscape.
 */
export function portraitToLandscapeTurn(selectedLandscape: boolean, browserIsLandscape: boolean): QuarterTurn {
  return selectedLandscape && !browserIsLandscape ? "ccw" : "cw";
}

export function rotatePixelPoint(point: XY, sourceWidth: number, sourceHeight: number, turn: QuarterTurn): XY {
  return turn === "ccw"
    ? { x: point.y, y: sourceWidth - point.x }
    : { x: sourceHeight - point.y, y: point.x };
}

export function rotateNormPoint(point: XY, turn: QuarterTurn): XY {
  return turn === "ccw"
    ? { x: point.y, y: 1 - point.x }
    : { x: 1 - point.y, y: point.x };
}

/** Preserve the same pixel radius after swapping portrait width and height. */
export function rotateWidthNormalizedRadius(radius: number, sourceWidth: number, sourceHeight: number) {
  return radius * sourceWidth / sourceHeight;
}
