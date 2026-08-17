import React from "react";

const ICONS = {
    "arrow-left": "M19 12H5m7-7-7 7 7 7",
    "bar-chart": "M4 19V9m6 10V5m6 14v-7m4 7H3",
    "building": "M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M3 21h18",
    "calendar": "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    "camera": "M14.5 4 13 6H8L6.5 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-5.5ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "check": "M20 6 9 17l-5-5",
    "check-circle": "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14.01l-3-3",
    "chevron-down": "m6 9 6 6 6-6",
    "chevron-left": "m15 18-6-6 6-6",
    "chevron-right": "m9 18 6-6-6-6",
    "clipboard-check": "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a3 3 0 0 1 6 0M9 5h6m-6 9 2 2 4-5",
    "clock": "M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    "cloud-upload": "M12 16V8m0 0-4 4m4-4 4 4M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25",
    "columns": "M3 6h18M3 12h18M3 18h18",
    "eye": "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "file-pdf": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 16h1.5a1.5 1.5 0 0 0 0-3H8v5m5-5v5h1a2.5 2.5 0 0 0 0-5Zm5 0h-2v5m0-2h2",
    "filter": "M3 5h18M7 12h10M10 19h4",
    "history": "M3 12a9 9 0 1 0 3-6.7M3 5v6h6m3-4v5l3 2",
    "info": "M12 17v-5m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    "layout": "M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z",
    "list-check": "M9 6h12M9 12h12M9 18h12M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2",
    "log-out": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
    "map-pin": "M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "moon": "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z",
    "pen": "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
    "plus": "M12 5v14M5 12h14",
    "refresh": "M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8M18 2v4h-4M6 22v-4h4",
    "search": "m21 21-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z",
    "server": "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm0 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Zm3-7h.01M7 17h.01",
    "settings": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a7.8 7.8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L16 3h-4l-.4 3a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 3h4l.4-3a8 8 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5c.1-.3.1-.7.1-1Z",
    "signature": "M3 17c3-5 4-10 7-10 4 0 0 9 4 9 2 0 3-4 5-4 1.5 0 1.5 2 2 3M3 21h18",
    "sliders": "M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4",
    "sun": "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "trash": "M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v6m4-6v6",
    "triangle": "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01",
    "video": "M15 10 21 6v12l-6-4v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z",
    "video-off": "m2 2 20 20M15 10l6-4v12l-4.2-2.8M15 15.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8c0-.7.3-1.3.8-1.6M7 6h6a2 2 0 0 1 2 2v2",
    "x": "M18 6 6 18M6 6l12 12"
};

export function Icon({ name, size = 18, className = "", strokeWidth = 2.2 }) {
    const path = ICONS[name] || ICONS.info;

    return (
        <svg
            aria-hidden="true"
            className={`icon ${className}`.trim()}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
        >
            <path d={path} />
        </svg>
    );
}
