export default function OrbitLoadingFallback({ height = 400 }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 bg-black"
      style={{ height }}
    >
      {/* Animated wireframe globe */}
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="animate-spin" style={{ animationDuration: '4s' }}>
        <circle cx="40" cy="40" r="34" stroke="#1B6CA8" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
        <ellipse cx="40" cy="40" rx="34" ry="14" stroke="#1B6CA8" strokeWidth="1" strokeDasharray="3 4" opacity="0.4" />
        <ellipse cx="40" cy="40" rx="14" ry="34" stroke="#1B6CA8" strokeWidth="1" strokeDasharray="3 4" opacity="0.4" transform="rotate(30 40 40)" />
        <circle cx="40" cy="6" r="3" fill="#60A5FA" />
        <line x1="40" y1="6" x2="40" y2="74" stroke="#1B6CA8" strokeWidth="0.8" opacity="0.3" />
      </svg>
      <div className="text-[11px] font-mono text-gray-400 tracking-widest">LOADING 3D ORBIT VIEWER…</div>
      <div className="text-[9px] font-mono text-gray-600">Powered by CesiumJS</div>
    </div>
  )
}
