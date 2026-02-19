type ColorScheme = "light" | "dark";

let colorScheme = $state<ColorScheme>(
  window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light",
);

const mql = window.matchMedia("(prefers-color-scheme: dark)");
mql.addEventListener("change", (e) => {
  colorScheme = e.matches ? "dark" : "light";
});

function toggle() {
  document.startViewTransition(() => {
    colorScheme = colorScheme === "dark" ? "light" : "dark";
  });
}

export const themeStore = {
  get colorScheme() {
    return colorScheme;
  },
  toggle,
};
