export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 3h16a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm2 7v12h12V10H10Z"
        clipRule="evenodd"
      />
      <rect x="14" y="6" width="4" height="20" rx="2" fill="currentColor" />
    </svg>
  );
}
