import React from "react";
import "operator/css/ResizeHandles.css";

type HandleId = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";

const HANDLES: {
    id: HandleId;
    dx: -1 | 0 | 1;
    dy: -1 | 0 | 1;
    isCorner: boolean;
}[] = [
    { id: "tl", dx: -1, dy: -1, isCorner: true },
    { id: "tc", dx: 0, dy: -1, isCorner: false },
    { id: "tr", dx: 1, dy: -1, isCorner: true },
    { id: "ml", dx: -1, dy: 0, isCorner: false },
    { id: "mr", dx: 1, dy: 0, isCorner: false },
    { id: "bl", dx: -1, dy: 1, isCorner: true },
    { id: "bc", dx: 0, dy: 1, isCorner: false },
    { id: "br", dx: 1, dy: 1, isCorner: true },
];

const MIN_W = 80;
const MIN_H = 60;

type ResizeHandlesProps = {
    /** Returns the current rendered size to use as the drag baseline */
    getSize: () => { width: number; height: number };
    /** Called with the new pixel dimensions during drag */
    onResize: (width: number, height: number) => void;
    /** Called after each resize to trigger layout save */
    onLayoutChange: () => void;
    /** Show only the 4 corner handles (proportional resize only) */
    cornersOnly?: boolean;
    /** Ref to the container element, used to clamp size within the viewport */
    containerRef: React.RefObject<HTMLElement>;
};

/**
 * Renders Google-Docs-style resize handles around a component.
 * Edge handles resize one axis; corner handles resize proportionally.
 * All resizes are clamped so the component stays within the viewport.
 * The parent container must have position: relative.
 */
export const ResizeHandles = ({
    getSize,
    onResize,
    onLayoutChange,
    cornersOnly = false,
    containerRef,
}: ResizeHandlesProps) => {
    const visibleHandles = cornersOnly
        ? HANDLES.filter((h) => h.isCorner)
        : HANDLES;

    function makePointerDownHandler(
        dx: -1 | 0 | 1,
        dy: -1 | 0 | 1,
        isCorner: boolean,
    ) {
        return (event: React.PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);

            const startX = event.clientX;
            const startY = event.clientY;
            const { width: startW, height: startH } = getSize();
            const aspectRatio = startW / startH;

            // Snapshot container position once at drag start for clamping
            const rect = containerRef.current?.getBoundingClientRect();
            const maxW = rect
                ? Math.floor(window.innerWidth - rect.left)
                : window.innerWidth;
            const maxH = rect
                ? Math.floor(window.innerHeight - rect.top)
                : window.innerHeight;

            function clamp(w: number, h: number): [number, number] {
                return [
                    Math.max(MIN_W, Math.min(maxW, w)),
                    Math.max(MIN_H, Math.min(maxH, h)),
                ];
            }

            function handleMove(e: PointerEvent) {
                // dx/dy: negative means dragging that direction grows the dimension
                const rawDx = (e.clientX - startX) * dx;
                const rawDy = (e.clientY - startY) * dy;

                let newW: number;
                let newH: number;

                if (isCorner) {
                    const delta = (rawDx + rawDy) / 2;
                    const scale = 1 + delta / Math.max(startW, startH);
                    let w = Math.round(startW * scale);
                    let h = Math.round(w / aspectRatio);
                    // Fit within viewport while maintaining aspect ratio
                    if (w > maxW) {
                        w = maxW;
                        h = Math.round(w / aspectRatio);
                    }
                    if (h > maxH) {
                        h = maxH;
                        w = Math.round(h * aspectRatio);
                    }
                    [newW, newH] = clamp(w, h);
                } else {
                    const w =
                        dx !== 0 ? Math.round(startW + rawDx) : startW;
                    const h =
                        dy !== 0 ? Math.round(startH + rawDy) : startH;
                    [newW, newH] = clamp(w, h);
                }

                onResize(newW, newH);
                onLayoutChange();
            }

            function handleUp() {
                window.removeEventListener("pointermove", handleMove);
                window.removeEventListener("pointerup", handleUp);
            }

            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", handleUp);
        };
    }

    return (
        <>
            {visibleHandles.map(({ id, dx, dy, isCorner }) => (
                <button
                    key={id}
                    type="button"
                    className={`component-resize-handle component-resize-handle-${id}`}
                    aria-label={`Resize ${id}`}
                    onPointerDown={makePointerDownHandler(dx, dy, isCorner)}
                />
            ))}
        </>
    );
};
