import { mount } from 'svelte';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import './tokens.css';
import './app.css';
import App from './ui/App.svelte';
import { trackInputModality } from './ui/components/input-modality';
import { config } from '@config';
import { detectLang } from '@lib/i18n';

document.title = config.name;
document.documentElement.lang = detectLang();
// The focus ring only for the keyboard (design-system.md, "Foco: anel só para o teclado").
trackInputModality(document, document.documentElement);
const app = mount(App, { target: document.getElementById('app')! });
export default app;
