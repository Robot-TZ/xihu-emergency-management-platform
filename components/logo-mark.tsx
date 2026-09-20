export function LogoMark({ size = 40, outline }: { size?: number; outline?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="100" fill="#14334D" stroke={outline} strokeWidth={outline ? 8 : 0} />
      <circle cx="256" cy="148" r="40" fill="#D4AF6A" />
      <circle cx="256" cy="236" r="13" fill="#D4AF6A" />
      <path d="M236 252 L276 252 L284 336 L228 336 Z" fill="#D4AF6A" stroke="#D4AF6A" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="256" cy="294" r="15" fill="#14334D" />
      <rect x="224" y="340" width="64" height="14" rx="7" fill="#D4AF6A" />
      <rect x="210" y="358" width="92" height="18" rx="9" fill="#D4AF6A" />
      <circle cx="150" cy="266" r="10" fill="#D4AF6A" />
      <path d="M134 280 L166 280 L174 338 L126 338 Z" fill="#D4AF6A" stroke="#D4AF6A" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="150" cy="309" r="12" fill="#14334D" />
      <rect x="128" y="342" width="44" height="12" rx="6" fill="#D4AF6A" />
      <rect x="114" y="356" width="72" height="16" rx="8" fill="#D4AF6A" />
      <circle cx="362" cy="266" r="10" fill="#D4AF6A" />
      <path d="M346 280 L378 280 L386 338 L338 338 Z" fill="#D4AF6A" stroke="#D4AF6A" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="362" cy="309" r="12" fill="#14334D" />
      <rect x="340" y="342" width="44" height="12" rx="6" fill="#D4AF6A" />
      <rect x="326" y="356" width="72" height="16" rx="8" fill="#D4AF6A" />
      <path d="M112 416 Q152 402 192 416 Q232 430 272 416 Q312 402 352 416 Q392 430 432 416" fill="none" stroke="#5FB3AC" strokeWidth="8" strokeLinecap="round" />
      <path d="M144 442 Q184 428 224 442 Q264 456 304 442 Q344 428 384 442" fill="none" stroke="#5FB3AC" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
