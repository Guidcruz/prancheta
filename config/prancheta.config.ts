/**
 * Central brand/project configuration. Everything (game, site, admin, PWA manifest,
 * icons, legal pages) reads from here. Change the brand once, rebuild, done.
 *
 * Rules:
 * - No other file may hard-code the game name, slogan, colors, domain or contacts.
 * - `domain` is the one field that cannot change freely after launch: local saves are
 *   bound to the origin. Decide it early; keep export/import of saves available.
 */
export const config = {
  /** Full product name, as shown in titles and the installed app. */
  name: 'Prancheta',
  /** Short name for the home screen icon (max 12 chars). */
  shortName: 'Prancheta',
  /** One-line pitch. */
  slogan: {
    'pt-BR':
      'O jogo de técnico de futebol para jogar no celular, com o Brasil inteiro na prancheta.',
    es: 'El juego de director técnico para jugar en el celular, con toda Sudamérica en la pizarra.',
    en: 'The football manager game for your phone, with all of Brazil on the clipboard.',
    /**
     * Highlighted tail of the slogan (hero) and title of the share image on the home page.
     * Must be the end of the slogan, ignoring case and the final period.
     */
    short: {
      'pt-BR': 'O Brasil inteiro na prancheta',
      es: 'Toda Sudamérica en la pizarra',
      en: 'All of Brazil on the clipboard',
    },
  },
  /** Logo as inline SVG path data (plain type for now; replace when the brand exists). */
  logo: {
    /** SVG markup of the mark, viewBox 0 0 64 64. */
    mark: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="6" width="48" height="52" rx="6" fill="#2fb866"/><rect x="24" y="2" width="16" height="8" rx="2" fill="#ffc83d"/><rect x="14" y="18" width="36" height="30" rx="2" fill="none" stroke="#0f1a24" stroke-width="2"/><line x1="32" y1="18" x2="32" y2="48" stroke="#0f1a24" stroke-width="2"/><circle cx="32" cy="33" r="5" fill="none" stroke="#0f1a24" stroke-width="2"/></svg>',
    /** Whether a real logo exists. While false, the UI sets the name in plain type. */
    hasBrand: false,
  },
  /** Brand colors (mirrors design/tokens.json; the theme is generated from tokens). */
  colors: {
    primary: '#2fb866',
    accent: '#ffc83d',
    background: '#0f1a24',
    surface: '#172534',
    text: '#f2f5f7',
  },
  /** Domain and paths. Until the real domain is chosen, the Pages subdomain is used. */
  domain: 'prancheta-ad1.pages.dev',
  paths: { site: '/', game: '/jogo' },
  /** Languages: the first is the default. Texts live in app/src/content/<lang>/. */
  languages: ['pt-BR', 'es', 'en'] as const,
  /** Contacts and links shown in footer, help and support screens. */
  contacts: {
    /** Empty until a real mailbox exists (pages.dev has no e-mail). */
    supportEmail: '',
    supportUrl: '/suporte',
    donateUrl: '/apoiar',
    repository: 'https://github.com/Guidcruz/prancheta',
    /** Discussions page of the repository (support channel); empty hides the links. */
    discussionsUrl: 'https://github.com/Guidcruz/prancheta/discussions',
  },
  /** Legal identity for privacy policy and terms. */
  legal: {
    responsible: 'Guilherme',
    city: 'Pinhais, PR, Brasil',
    privacyUrl: '/privacidade',
    termsUrl: '/termos',
  },
  /** Placeholder sponsor shown in every empty sponsor slot. */
  placeholderSponsor: { name: 'Patrocine aqui', url: '/apoiar' },
  version: '0.0.1',
} as const;

export type Lang = (typeof config.languages)[number];
export type PranchetaConfig = typeof config;
