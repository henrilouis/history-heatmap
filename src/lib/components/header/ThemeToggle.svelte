<script lang="ts">
  import { themeStore } from "../../stores/theme.svelte";
</script>

<button
  onclick={themeStore.toggle}
  aria-label={themeStore.colorScheme === "light"
    ? "Switch to dark mode"
    : "Switch to light mode"}
  class="button {themeStore.colorScheme === 'dark' ? 'dark' : ''}"
  id="theme-toggle-button"
>
  <!-- Lucide "moon" and "sun" icons (ISC license): https://lucide.dev -->
  <div class="icon-wrapper">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      ></path>
    </svg>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="4"></circle>
      <path d="M12 2v2"></path>
      <path d="M12 20v2"></path>
      <path d="m4.93 4.93 1.41 1.41"></path>
      <path d="m17.66 17.66 1.41 1.41"></path>
      <path d="M2 12h2"></path>
      <path d="M20 12h2"></path>
      <path d="m6.34 17.66-1.41 1.41"></path>
      <path d="m19.07 4.93-1.41 1.41"></path>
    </svg>
  </div>
</button>

<style>
  ::view-transition-old(root) {
    animation-delay: 500ms;
  }

  ::view-transition-new(root) {
    animation: circle-in 500ms ease-in-out;
  }

  @keyframes circle-in {
    from {
      clip-path: circle(0% at calc(100% - 3.125rem) 2.125rem);
    }

    to {
      clip-path: circle(150% at calc(100% - 3.125rem) 2.125rem);
    }
  }

  #theme-toggle-button {
    position: relative;
    overflow: hidden;
    height: calc(var(--el-line-height) + calc(var(--el-padding-block) * 2));
    padding: calc(var(--el-padding-block) - 0.0625rem);

    & .icon-wrapper {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: transform 0.3s ease-in-out;
      transform: translateY(-2.25rem);

      & svg {
        transition: rotate 0.3s ease-in-out;
      }

      & svg:last-child {
        rotate: 360deg;
      }
    }
  }

  #theme-toggle-button.dark {
    & .icon-wrapper {
      transform: translateY(0);

      & svg:last-child {
        rotate: 0deg;
      }
    }
  }
</style>
