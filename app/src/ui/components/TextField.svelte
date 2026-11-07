<script lang="ts">
  import Icon from './Icon.svelte';

  /**
   * TextField: one line of text with a visible label, a hint, a counter and an error in text,
   * all tied to the input by `aria-describedby` (docs/design/telas/novo-jogo.md). Used for the
   * coach's nickname. The counter and the error come ready from the screen, which counts code
   * points after NFC like `checkCoachName`; there is no native `maxlength` (it counts UTF-16
   * units), so the player can type past the limit and reads why "Começar" is disabled.
   *
   * The input text is `body-lg` (17px): on the phone a field under 16px makes iOS zoom in on
   * focus (componentes.md, "Zoom no celular").
   */
  interface Props {
    label: string;
    value: string;
    /** "Fica só neste aparelho e no arquivo de backup." */
    hint?: string;
    /** "12/24", already formatted. */
    counter?: string;
    /** Past the limit: the counter turns to `ink` (the error text below says why). */
    counterOver?: boolean;
    /** Message in text; with it the field is `aria-invalid`. */
    error?: string;
    autocomplete?: HTMLInputElement['autocomplete'];
    enterkeyhint?: 'done' | 'next' | 'go';
    oninput: (value: string) => void;
    onenter?: () => void;
  }
  const {
    label,
    value,
    hint,
    counter,
    counterOver = false,
    error,
    autocomplete = 'off',
    enterkeyhint = 'done',
    oninput,
    onenter,
  }: Props = $props();
  const id = $props.id();
  const described = $derived(
    [hint && `${id}-hint`, counter && `${id}-counter`, error && `${id}-error`]
      .filter(Boolean)
      .join(' ') || undefined,
  );
</script>

<div class="field" class:invalid={error}>
  <label class="body-strong" for={id}>{label}</label>
  <input
    {id}
    class="input body-lg"
    type="text"
    {value}
    {autocomplete}
    {enterkeyhint}
    autocapitalize="words"
    spellcheck="false"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={described}
    oninput={(event) => oninput(event.currentTarget.value)}
    onkeydown={(event) => {
      if (event.key === 'Enter' && onenter) onenter();
    }}
  />
  <div class="under">
    {#if hint}<p class="caption muted" id="{id}-hint">{hint}</p>{/if}
    {#if counter}
      <p class="caption counter" class:over={counterOver} id="{id}-counter">{counter}</p>
    {/if}
  </div>
  {#if error}
    <p class="body error" id="{id}-error" role="alert">
      <Icon name="error" size={18} />{error}
    </p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .input {
    min-height: var(--touch);
    padding: var(--space-2) var(--space-3);
    border: 2px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    color: var(--ink);
    /* The input does not inherit the body type by default. */
    font-family: var(--font-body);
  }
  .input:focus-visible {
    border-color: var(--focus);
    outline-offset: 0;
  }
  .invalid .input {
    border-color: var(--danger);
  }
  .under {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
  }
  p {
    margin: 0;
  }
  .muted {
    color: var(--ink-muted);
  }
  .counter {
    margin-left: auto;
    flex: none;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .counter.over {
    color: var(--ink);
  }
  .error {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    color: var(--ink);
  }
  /* The error is the text; the icon only reinforces it. */
  .error :global(svg) {
    margin-top: var(--space-1);
    color: var(--danger);
  }
</style>
