<script lang="ts">
  import { config } from '@lib/config';
  import { detectLang, t } from '@lib/i18n';
  import { shieldSpecFor, shieldSvg } from '@lib/generators/shield';

  const lang = detectLang();
  const shield = shieldSvg(
    shieldSpecFor('prancheta', config.colors.primary, config.colors.accent),
    96,
  );
  let pressed = $state(false);
</script>

<main>
  <header>
    {#if config.logo.hasBrand}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from config/prancheta.config.ts, never user input -->
      <div class="logo">{@html config.logo.mark}</div>
    {/if}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- SVG from our own generator with constant inputs, never user input -->
    <div class="shield">{@html shield}</div>
    <h1 class="titulo">{config.name}</h1>
    <p class="body subtitle">{t('home.subtitle', lang)}</p>
  </header>

  <section class="actions">
    <button class="primary botao" onclick={() => (pressed = true)}>{t('home.play', lang)}</button>
    {#if pressed}
      <p class="body soon" role="status">{t('home.soon', lang)}</p>
    {/if}
    <a class="link" href={config.paths.site + 'devlog/'}>{t('home.devlog', lang)}</a>
  </section>

  <footer class="caption">{t('home.version', lang, { version: config.version })}</footer>
</main>

<style>
  main {
    min-height: 100dvh;
    display: grid;
    grid-template-rows: 1fr auto auto;
    padding: var(--space-8) var(--space-4) var(--space-6);
    max-width: 480px;
    margin: 0 auto;
  }
  header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: var(--space-3);
  }
  .logo {
    width: 64px;
    height: 64px;
  }
  .subtitle {
    color: var(--ink-muted);
    max-width: 32ch;
    margin: 0;
  }
  h1 {
    margin: 0;
  }
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6) 0;
  }
  .primary {
    min-height: var(--touch);
    padding: 0 var(--space-6);
    border: 0;
    border-radius: var(--radius-pill);
    background: var(--grass);
    color: var(--on-grass);
    cursor: pointer;
  }
  .soon {
    margin: 0;
    color: var(--ink-muted);
    text-align: center;
  }
  .link {
    color: var(--info);
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
  }
  footer {
    text-align: center;
    color: var(--ink-muted);
  }
</style>
